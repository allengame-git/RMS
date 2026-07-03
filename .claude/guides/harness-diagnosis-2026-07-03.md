# Harness 診斷報告（2026-07-03 快照）

> 由 Fable 5 session 產出。這是「當時的診斷」，不是永久規則。若下列描述與現況不符（檔案已刪、行數已變），以現況為準，並依 [maintenance-protocol.md](maintenance-protocol.md) 更新本檔。

## 排名第一：每個 session 固定注入的 context 過胖且有兩份會分岔的真相來源

**證據（2026-07-03 量測）**：
- CLAUDE.md 114 行全內聯，每個 session 都載入。
- `AGENTS.md`（給 Codex 用）與 CLAUDE.md 內容約 95% 重複，且已經分岔：AGENTS.md 說 seed 會建立 `admin/adminpassword`，CLAUDE.md 說需要 `ADMIN_PASSWORD` 環境變數（後者才對，已驗證 `scripts/seed-admin.ts`）；AGENTS.md 的 Security Gotchas 也比 CLAUDE.md 少 4 條（角色重驗、自我審批、錯誤訊息、實體檔案清理）。兩份檔各自維護，必然繼續分岔。
- superpowers plugin 的 SessionStart hook 每個 session 注入一大段技能規則文字，加上約 80 個 skill 描述、多個 MCP server 說明。這部分不在 repo 內，是使用者層級設定。

**修法**：
1. CLAUDE.md 已重寫為「核心事實 + 路由」（本次已完成，備份在 `.claude/backups/`）。
2. ~~AGENTS.md 開頭加警告、或縮為指標檔~~ **已解決（2026-07-03，經使用者批准）**：AGENTS.md 已縮為指向 CLAUDE.md 的指標檔，單一真相來源確立。
3. superpowers hook 與未用到的 plugin（pencil、SketchUp、Gmail 等對本 repo 幾乎用不到）是使用者層級設定，AI 不可自行停用；已列入 [letter-to-next-session.md](letter-to-next-session.md) 給使用者的建議。

## 排名第二：主對話親自下場讀大檔、掃 repo，context 被填滿後失焦

**證據**：
- `docs/*.md` 非遞迴共約 11,300 行（加計根目錄 README/NextSteps/ARCHITECTURE 等說明檔逾 12,000 行），其中 `tech.md` 1,417 行、`linux_install.md` 1,234 行、多個一月份的 plan/task 檔已完成卻仍在原地。主模型若直接 Read 這些檔，幾輪就吃掉大半 context，之後觸發摘要壓縮，早期指令與使用者要求最容易在壓縮中遺失。
- `docs/NEXT_STEPS.md`（2025-12-30，109 行）與根目錄 `NextSteps.md`（2026-06-09，185 行）是新舊兩份同名職責的檔案，弱模型會讀到舊的那份然後照做。

**修法**：
1. 大量讀取、掃 repo、查文件一律派 subagent，主對話只收結論——規則已寫死在 [model-dispatch.md](model-dispatch.md)，CLAUDE.md 有路由指過去。
2. ~~舊 plan/task 檔待歸檔~~ **已解決（2026-07-03，經使用者批准）**：12 個檔已 `git mv` 到 `docs/archive/`。
3. `docs/archive/NEXT_STEPS.md`（原 `docs/NEXT_STEPS.md`）過時：任何 session 要讀「下一步」只讀根目錄 `NextSteps.md`。已寫入 CLAUDE.md 路由。

## 排名第三：驗證靠自驗與過時文件，出錯後在同一條路上重試

**證據**：
- AGENTS.md 的 seed 帳密錯誤就是「文件漂移沒人驗」的實例。README/ARCHITECTURE/NextSteps 由 milestone-handoff 更新，但沒有機制保證與程式碼一致。
- 專案記憶目錄（`~/.claude/projects/-Users-allen-Desktop-LLRWD-Manage-System/memory/`）在本 session 開始時完全是空的——跨 session 教訓從未累積，同樣的坑會重踩。（本 session 已寫入首批記憶：MEMORY.md 索引與治理文件指標。）
- 沒有成文的「何時停止重試、何時升級模型」規則，弱模型預設行為是原地重試到 context 耗盡。

**修法**：
1. 文件與程式碼衝突時，一律以程式碼為準，並順手修文件——已寫入 [judgment-rubrics.md](judgment-rubrics.md)。
2. 驗收一律派 fresh-context subagent，不由做事的同一個 context 自驗——規則在 [model-dispatch.md](model-dispatch.md) 的「驗證不自驗」節。
3. 升降級路徑（錯幾次、帶什麼證據升級）在 [model-dispatch.md](model-dispatch.md)；踩坑教訓寫回哪裡在 [maintenance-protocol.md](maintenance-protocol.md)。

## 次要觀察（不進前三，但便宜可修）

- ~~`settings.local.json` allowlist 塞滿一次性命令~~ **已解決（2026-07-03）**：pattern 式規則寫入 `.claude/settings.json`，local 檔已清空。
- ~~`rms-code-review-prompt.md` 放錯目錄~~ **已解決（2026-07-03）**：已移到 `.claude/guides/`。
