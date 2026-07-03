# 維護協議：如何安全地更新這套治理文件

適用對象：未來任何要修改 CLAUDE.md 或 `.claude/guides/*` 的模型。

## 通則（每次改動都要做）

1. **改前備份**：`cp <檔案> .claude/backups/<檔名>.<YYYY-MM-DD>.bak`。同一天改同一檔第二次不用再備份。
2. **改後自查**：(a) 用 ls 或 Read 確認你在檔中引用的每個路徑、工具名、參數值真實存在；(b) 檢查新規則有沒有跟同檔或 CLAUDE.md 的既有規則打架。查到打架就別提交，先解決衝突。
3. **改動要留痕**：在被改的檔案裡不用寫變更紀錄（git 會記），但 commit message 或回報中要說明改了哪條、為什麼。

## 可以自行改（不用問使用者）

- 修正**已驗證**的事實錯誤：路徑不存在、工具參數名錯、命令跑不動。條件是你必須先實際驗證（跑過命令、ls 過路徑），不能憑印象改。
- 在 `.claude/guides/lessons.md` **追加**踩坑教訓（格式見下）。
- 在 judgment-rubrics.md 的既有判準下**追加**正例／反例。
- 更新 harness-diagnosis 中已失效的描述（例如某問題已修復，標註「已解決於 <日期>」）。
- 把已泛化的教訓從 lessons.md 升格為對應 guide 的正式規則（升格後從 lessons.md 刪除原條目）。

## 動之前必須先問使用者

- 刪除任何 guide 檔案、CLAUDE.md 的任何整節、Security Checklist 的任何一條。
- 改變 model-dispatch.md 的模型選擇預設（哪種任務用哪個 model）——這直接影響花費。
- 改變「什麼情況要問使用者」的判準本身（judgment-rubrics.md 第 3 節）——弱模型不得自行放寬自己的自主權限。
- 重構 CLAUDE.md 的路由表結構；改 AGENTS.md 的**結構或刪節**（那是 Codex 的入口）。例外：把 AGENTS.md 的事實性內容同步到與 CLAUDE.md 一致（且已實際驗證過對錯）屬「可自行改」，照通則備份即可。
- 批次移動／歸檔／刪除 docs/ 下的檔案（可以先列清單附建議，等使用者點頭）。

## 踩坑教訓寫回哪裡、用什麼格式

寫到 `.claude/guides/lessons.md`（不存在就建立，開頭抄本節格式說明）。一條教訓一個區塊：

```markdown
## 2026-07-15 — reorder 後歷史記錄缺子項目
- 情境：實作項目搬移功能時
- 錯在哪：只為直接目標寫 ItemHistory，漏了 cascade 影響到的子項目
- 正確做法：先 collectDescendantChanges() 再 batchCascadeFullIdChanges()，對所有受影響項目寫歷史
- 相關檔案：src/actions/item-reorder.ts
- 已重踩次數：1
```

同一個坑第二次踩到：把既有條目的「已重踩次數」+1，**不要**另開新條目。重踩次數到 2 → 這條該升格成 CLAUDE.md Domain Rules 或對應 guide 的正式規則（升格屬「可自行改」，但若要進 Security Checklist 需問使用者）。

## 累積多長要精簡

- 任何單一 guide 超過 **180 行**，或 lessons.md 超過 **25 條** → 觸發精簡：合併重複、把過時內容標註後移到 `.claude/backups/`、把反覆出現的教訓升格為規則。
- 精簡是「改結構」等級的動作：產出精簡後版本 + 一份「刪了什麼、為什麼」清單，問過使用者再落檔。
- harness-diagnosis 快照類檔案不精簡，過時就整檔標註「已過時，僅供歷史參考」。

## 記憶目錄 vs repo guides 的分工

- **repo guides（本目錄）**：跟這個專案綁定的規則、教訓、流程。換機器、換人都要跟著 repo 走的，放這裡。
- **使用者層級記憶**（`~/.claude/projects/-Users-allen-Desktop-LLRWD-Manage-System/memory/`）：使用者個人偏好（回報風格、語言、工作習慣）與跨 session 的工作狀態。專案技術知識**不要**放記憶目錄——放了 repo 之外就看不到，且會跟 guides 分岔。
- 兩邊都要更新時，先寫 repo guide，記憶目錄只放一行指標。
