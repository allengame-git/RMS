# 給未來 session 的信

寫於 2026-07-03，由建立這套治理文件的 Fable 5 session 留下。每個 session 開始做大任務前讀一次即可，不用每輪重讀。

## 三件使用者沒問、但對這個環境最重要的事

### 1. 這個 repo 有兩套 AI 入口，會持續分岔（2026-07-03 已大幅緩解）

CLAUDE.md（Claude Code 讀）與 AGENTS.md（Codex 讀）曾是重複拷貝且實際分岔過（seed 帳密、Security Gotchas 少 4 條，AGENTS.md 是錯的那份）。經使用者批准，AGENTS.md 已縮為指向 CLAUDE.md 的指標檔，單一真相來源確立。**殘餘的同步點**：`.claude/agents/` 與 `.codex/agents/` 仍是平行的兩套審查員定義——改任一邊的審查範圍描述時，檢查另一邊要不要跟。

### 2. 每個 session 的固定注入成本很高，而且其中有規則張力

superpowers plugin 的 SessionStart hook、約 80 個 skill 描述、多個與本 repo 無關的 MCP server（pencil、SketchUp、Gmail、Calendar）每次都注入 context。這是使用者層級設定，AI 不可自行停用，但值得提醒使用者盤點（用不到的 plugin 每個 session 都在燒 token）。另外注意：superpowers 要求「任何動作前先 invoke skill」，與使用者的「自主作業、不停下來等待」規則有張力——**使用者明示指令永遠優先於 skill 的流程要求**，superpowers 自己的說明文字也承認這點。不要因為 hook 的大寫粗體就把它排在使用者指令前面。

### 3. 「驗證不自驗」目前只有兩顆牙齒

這套制度反覆強調用命令輸出當證據，但本 repo 可自動執行的驗證只有 `npx vitest run` 與 `npx tsc --noEmit`（外加 build）。審批流、fullId cascade、備份還原這些最危險的路徑，很大部分靠人工實跑與審查員判讀。如果未來有餘裕，最高價值的基礎建設投資是：一組可腳本化的冒煙測試（登入 → 建項目 → 送審 → 核准 → 還原），讓「完成」的證據從「審查員說沒問題」升級成「流程實跑通過」。在那之前，涉及這些路徑的改動要老實把「未實跑驗證」寫進風險回報。（誠實標註：我沒有量測過測試覆蓋率的具體數字，上述是從測試檔清單與 guides 推斷的定性判斷。）

## 這套制度最可能的退化方式與預防

1. **規則存在但沒人照做**（最隱性）。文件載入了，模型還是憑本能自己下場讀大檔。預防：CLAUDE.md 路由表把 guides 放在觸發條件旁邊，違規最常發生在 session 開頭——開工前先問自己「這件事 model-dispatch 有沒有規定派工」。使用者端的預防是抽查：發現主對話在貼大段檔案內容，就是違規訊號。
2. **模板儀式化**。弱模型複製模板但驗收條件填成「功能正常運作」這種空話。預防：delegation-templates.md 已標明填不出驗收條件就不准派工；驗收員模板要求逐條證據，空話條件會在驗收時暴露。
3. **例外累積到規則互相矛盾**。每次踩坑加一條規則，三個月後規則打架。預防：教訓先進 lessons.md 隔離區，重踩兩次才升格為規則（maintenance-protocol.md 已規定）；升格時做一致性自查。
4. **路由失效與快照過時**。檔案搬家但路由表沒更新；harness-diagnosis 的 2026-07-03 數字被當成現況。預防：搬 guide 檔必同步改 CLAUDE.md 路由（維護協議通則）；快照檔頭已標註「以現況為準」。

## 交接：本次 session 留下的未完成事項

使用者於 2026-07-03 批准全部建議，以下五項已執行完畢：

- [x] `docs/` 歸檔：11 個 `*_plan.md`/`*_task.md` 與 `NEXT_STEPS.md` 已 `git mv` 到 `docs/archive/`；README 與 CLAUDE.md 的引用已同步更新。
- [x] allowlist 重建：精選規則寫入 `.claude/settings.json`；`settings.local.json` 已清空（舊檔備份於 `.claude/backups/settings.local.json.2026-07-03.bak`）。
- [x] `rms-code-review-prompt.md` 已移到 `.claude/guides/`。
- [x] AGENTS.md 已縮為指標檔，以 CLAUDE.md 為單一真相來源（縮減前版本備份於 `.claude/backups/AGENTS.md.2026-07-03-pre-slim.bak`）。
- [x] `ts-node@^10.9.2` 已加入 devDependencies，`npx prisma db seed` 實測可解析執行。

仍待使用者處理：

- [ ] 使用者層級 plugin 盤點（見上文第 2 點）——這是 `~/.claude` 層級設定，AI 不可自行動。
- [ ] 上述改動尚未 commit，等使用者確認後提交。
