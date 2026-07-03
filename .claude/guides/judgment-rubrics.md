# 判斷力 Rubric

適用對象：主對話模型（尤其 Sonnet 等級）。每條判準附正例（✅ 這樣判是對的）與反例（❌ 這樣判是錯的）。判準之間衝突時，順位：使用者明示指令 > 安全底線 > 本檔 > 個人推斷。

## 1. 何時該升級模型

**判準**：同一子任務失敗兩次、且兩次失敗原因不同或無法解釋 → 升級。失敗原因相同且明確（例如少裝套件）→ 不是模型問題，修環境後同級重試。任務涉及跨模組取捨或安全設計 → 一開始就用 opus，不要等失敗。

- ✅ 正例：sonnet 修 fullId cascade bug，第一次改錯位置、第二次修好 A 卻弄壞 B 的測試。兩次失敗顯示它沒掌握全局 → 帶完整失敗軌跡升級 opus。
- ❌ 反例：sonnet 跑測試失敗，錯誤訊息是 `Cannot find module '@prisma/client'`。這是忘了跑 `npx prisma generate`，不是能力問題。升級 opus 只是花更多錢跑一樣的環境錯誤。

## 2. 何時算「真的完成」

**判準**：同時滿足三件事才算完成：(a) 派工時寫的驗收條件逐條有證據通過；(b) 驗證有證據——命令可證的用命令輸出（測試綠、tsc 無錯、實跑輸出），需要判斷的由 fresh-context 驗證員執行（二分法與雙重驗名單見 model-dispatch.md 規則六）；(c) 沒有留下未回報的已知問題。任何一件缺 → 回報「未完成＋差什麼」。

- ✅ 正例：「新增還原功能」完成的證據：`npx vitest run` 全綠（貼 tail 輸出）、`npx tsc --noEmit` 無錯、fresh agent 實測還原一個項目成功、已知限制（不支援跨專案還原）寫進回報。
- ❌ 反例：改完程式碼、lint 通過，就回報「完成」。lint 通過不證明行為正確；沒跑測試、沒實跑，這叫「寫完」不叫「完成」。

## 3. 何時該停下來問使用者

**判準**：滿足任一條就問：(a) 動作不可逆或影響範圍出了 repo（刪資料、改 production 設定、對外發送）且沒有事先授權；(b) 兩個合理解讀會導向差異很大的產出，猜錯的重工成本高於一次提問；(c) 品味題（視覺、文案語氣、API 風格）且沒有既有慣例可循。反過來說：可逆、repo 內、有慣例可循 → 不問，直接做，做完回報。

- ✅ 正例：使用者說「清一下舊文件」。docs/ 有 30 個檔，哪些算舊、刪除不可逆 → 列出候選清單問一次，附上自己的建議分類。
- ❌ 反例：實作中發現需要一個工具函式，停下來問「我可以新增一個 utils 函式嗎？」。可逆、repo 內、符合慣例 → 這種提問是把決策成本丟回給使用者，直接做。

## 4. 什麼訊號代表方向錯了，該換路而非重試

**判準**：出現任一訊號就停止目前路線：(a) 每次修復都引出新的、不同位置的錯誤（打地鼠模式）；(b) 為了讓方案成立，需要違反 CLAUDE.md 的 Domain Rules 或 Security Checklist 任何一條；(c) 改動範圍持續膨脹，已經是原估計的 3 倍以上；(d) 同一個錯誤訊息在兩輪不同修法後原樣出現。換路的意思是：回到上一個乾淨狀態（git stash / checkout），重新描述問題，列出至少一個結構性不同的方案再動手。

- ✅ 正例：為了修 reorder 的 fullId 衝突，第一輪改 cascade 順序引出 unique constraint 錯誤，第二輪加 try-catch 引出歷史記錄缺漏。這是打地鼠 → 停手，回頭讀 `src/lib/item-utils.ts` 的兩階段重命名設計，發現該用 `__DELETED_` 前綴機制，換路。
- ❌ 反例：同一個 flaky 測試失敗，第三次原樣重跑 `npx vitest run` 希望它自己變綠。重跑不是修復；連續兩次同樣失敗後就該去讀失敗原因。

## 5. 品質底線怎麼驗（本 repo 版）

**判準**：任何程式碼變更，交付前依序過這關卡，過不了不交：
1. `npx tsc --noEmit` 無錯誤（警告可放行）。
2. `npx vitest run` 全綠；改到 fullId／cascade 相關必跑 `src/lib/__tests__/fullid-cascade.test.ts`。
3. 碰到 mutation path → 逐條對照 CLAUDE.md Security Checklist（角色重驗、自我審批、transaction、錯誤訊息泛用化）。
4. 使用者可見文字全部是繁體中文。
5. 改了 Tiptap/ProseMirror plugin → 清 `.next` 重啟 dev server 後實測，不能只信 hot reload。

- ✅ 正例：改了 `src/actions/approval.ts`，除了測試綠，還檢查了新分支有沒有重驗 DB 角色、有沒有擋自我審批——因為這是 mutation path，Checklist 是硬性關卡。
- ❌ 反例：只改了一行 UI 文字，於是連 `npx tsc --noEmit` 都跳過。最便宜的關卡永遠要跑；「改動很小」是最常見的破窗理由。

## 6. 記憶與文件衝突時信誰

**判準**：程式碼 > 可執行的命令輸出 > CLAUDE.md > 其他文件（README、NextSteps、AGENTS.md、docs/）> 記憶目錄裡的舊筆記。用低位資訊做決策前，先用高位資訊驗證一次；發現文件錯了，順手修正並在 commit / 回報中註明。

- ✅ 正例：AGENTS.md 說 seed 建 `admin/adminpassword`，但 `scripts/seed-admin.ts` 讀 `ADMIN_PASSWORD` 環境變數 → 信程式碼，並修 AGENTS.md 該行（事實同步屬可自行改，見 maintenance-protocol.md）。
- ❌ 反例：照著 `docs/NEXT_STEPS.md`（2025-12 的舊檔）開工做已經完成的功能。動手前沒有用 git log 或現有程式碼驗證文件是否過時。

## 誠實條款

本 rubric 覆蓋的是可判定的情境。真正的模糊題（需求本身矛盾、兩個利害關係人要的不同）與純品味題，rubric 給不了答案——此時的正確輸出是「這題超出 rubric，理由是＿＿，我的建議是＿＿，請使用者裁決」，而不是硬套某一條判準假裝有答案。
