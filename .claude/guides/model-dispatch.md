# 模型調度守則

適用對象：本 repo 的主對話模型（任何等級）。目的：省 token、保持主對話焦點、讓錯誤在便宜的地方發生。

## 本環境的硬事實（2026-07-03 驗證，過時請照 maintenance-protocol.md 更新）

- Agent 工具的 `model` 參數只接受四個值：`haiku`、`sonnet`、`opus`、`fable`。
- Agent 工具**沒有** effort 參數。effort 只能在兩處設定：`.claude/agents/*.md` 的 frontmatter，或 Workflow 工具內 `agent()` 的 `opts.effort`（`low`/`medium`/`high`/`xhigh`/`max`）。不要在 Agent 工具呼叫裡寫 effort，那會是無效參數。
- `model` 省略時 subagent 繼承主對話的模型。主對話通常是最貴的模型，所以**派工時一律顯式指定 model**，不要省略。**唯一例外**：有定義檔的 agent 類型（rms-*、feature-dev:* 等 `.claude/agents/` 或 plugin 定義的）**不要**傳 model——顯式傳入會覆蓋定義檔設定，例如把定義檔指定 opus 的安全審查員靜默降級成 sonnet。
- Workflow 工具（多 agent 編排）需要使用者明確要求（說「ultracode」或「用 workflow」）才能用。沒被要求就用 Agent 工具逐個派。注意：Workflow 只存在於主對話的工具清單，subagent 環境沒有；若你自己的工具清單裡也沒有 Workflow，本條與 effort 的 Workflow 設定方式對你不適用，忽略即可。
- 可用 agent 類型：`Explore`（唯讀搜尋）、`Plan`（規劃）、`general-purpose`（全工具）、`code-simplifier:code-simplifier`、`feature-dev:code-explorer` / `code-architect` / `code-reviewer`、`rms-security-reviewer`、`rms-backend-reviewer`、`rms-frontend-reviewer`、`rms-architecture-reviewer`（後四個是本 repo 專屬審查員）、`claude-code-guide`（Claude Code 本身的問題）。
- 多個獨立派工要放在**同一則訊息**裡一起發，讓它們並行。subagent 預設在背景跑；需要先拿到結果才能繼續時，設 `run_in_background: false`。
- 要接續某個 subagent 的既有 context，用 SendMessage 指名它，不要重派新的。

## 規則一：指揮官不下場

主對話的 context 是全 session 最貴的資源。以下工作**必須**派 subagent，主對話只收結論：

| 情境 | 派給誰 | model |
|---|---|---|
| 回答問題需要讀 3 個以上檔案，或單檔／本次合計預估閱讀量超過 400 行 | Explore | sonnet |
| 全 repo 掃描（grep 某 pattern 的所有出現、盤點某慣例） | Explore | sonnet |
| 查網頁、查外部文件、做研究 | general-purpose | sonnet |
| 批次機械式改檔（同一 pattern 改 3 個以上檔案） | general-purpose | haiku 或 sonnet |
| 跨多檔的功能實作 | general-purpose | sonnet，難的用 opus |
| 程式碼審查 | rms-* 審查員（照領域選） | 定義檔已設定，不用指定 |

**可以自己動手的例外**：已知確切檔案和位置的單點查證（一個 Read 解決）；改的檔案已完整在自己 context 裡；跟使用者的對話本身。

**派了就不要自己再做一遍**。派出去等結果，結果不滿意照升降級規則處理。

## 規則二：派工三件套

每個派工 prompt 必須包含三件事，缺一件就是壞派工（模板見 [delegation-templates.md](delegation-templates.md)）：

1. **目標與動機**：要達成什麼、為什麼要做（動機讓 subagent 在遇到岔路時能自己做對的取捨）。
2. **驗收條件**：可客觀判定的完成標準。「修好 bug」不合格；「`npx vitest run src/lib/__tests__/fullid-cascade.test.ts` 全綠且未改動測試檔」合格。
3. **回報格式**：明確說要回什麼、不要回什麼（見規則四）。

## 規則三：model 選擇

| model | 用途 | 不要用在 |
|---|---|---|
| `haiku` | 機械式批次改檔、格式轉換、答錯成本低的簡單查找 | 任何需要判斷取捨的事 |
| `sonnet` | **預設工作馬**：搜尋、一般實作、寫測試、單維度審查、研究彙整 | 跨模組的架構決策 |
| `opus` | 難 debug、跨模組實作、架構取捨、對 sonnet 產出的二次意見 | 大量並行的便宜任務（太貴） |
| `fable` | 通常就是主對話本身。不要例行性派 fable subagent | 例行工作 |

不確定選哪個 → 選 sonnet。事後發現不夠力，照升降級規則升。

## 規則四：回報合約

寫進每個派工 prompt 的固定要求：

- 只回：**結論、關鍵證據（`檔案路徑:行號`）、風險或未完成事項**。
- 禁止把整個檔案內容貼回來。需要引用程式碼時，最多 10 行片段加 `檔案:行號`。
- 產出超過 50 行（報告、清單、生成的程式碼說明）→ 寫到檔案裡，只回傳檔案路徑加三行摘要。臨時檔寫到 scratchpad（系統提示裡有路徑），要保留的寫到 repo 內約定位置。
- 沒做完就明說「未完成＋卡在哪」，禁止回報「應該可以」「大致完成」這類模糊結論。

## 規則五：升降級路徑

- **haiku 答錯一次** → 直接改派 sonnet 重做，不給 haiku 第二次機會。
- **sonnet／opus 在同一個子任務連錯兩次** → 升一級重派，且 prompt 必須附上**完整失敗軌跡**：試過什麼、確切錯誤輸出、目前的假設。不附軌跡的升級會在同一個坑重摔一次。例外：兩次失敗原因相同且明確是環境問題（少裝套件、沒跑 prisma generate）→ 不是模型問題，修環境後同級重試，見 [judgment-rubrics.md](judgment-rubrics.md) 第 1 節。
- **升級後解出來了** → 把解法整理成明確步驟，降回 sonnet 或 haiku 批次套用到其餘同型工作。
- **重試計數規則**：「兩輪」指同一個模型層級內的嘗試次數；升級後重新計數（升級後再給兩輪）。同一個子任務**最多升級一次**——升級後兩輪仍失敗就停下來：換方法、或照 [judgment-rubrics.md](judgment-rubrics.md) 判斷是否該問使用者。次數要自己數，不要靠感覺。

## 規則六：驗證不自驗

做事的 context 會傾向認定自己做對了。驗證方式二分：**命令可證的，命令輸出就是證據**（測試綠、tsc 無錯、實跑輸出）；**需要判斷的**（規格符合度、邏輯正確性、文件品質），交給**沒看過實作過程的 fresh-context subagent**：

- **檔案類產出**（文件、設定、報告）→ 派一個 read-back 驗證員：給它驗收條件清單，要它逐條回報「通過／不通過＋證據行號」。不要給它實作時的推理過程，避免被帶著走。
- **程式碼** → 先跑測試或實跑（`npx vitest run`、`npx tsc --noEmit`、必要時 `npm run build`）。小型、低風險的改動，命令證據即可交付；涉及 **mutation path、安全、fullId cascade、備份還原**的改動，測試綠之後**還要**派審查員看邏輯（雙重驗）。測試不能跑就明說，不能拿「看起來對」交差。
- **高風險判斷**（安全、資料破壞、架構方向）→ 加第二意見：派另一個 opus 用不同角度重新判一次；或產三個獨立答案派評審員選優。兩個意見衝突時升級到主對話裁決，還是衝突就問使用者。
- 驗證員的 model：涉及判斷力的驗證（邏輯審查、二次意見、方向裁決）至少要跟實作者同級；純機械式驗證（檔案存在、章節齊全、跑命令看輸出）用 `sonnet` 即可。

## 誠實條款

這套守則補得了執行品質（拆解、驗證、多樣本），補不了兩件事：**模糊需求的解讀**與**品味判斷**（UI 好不好看、文案順不順、API 設計優不優雅）。遇到這兩類，正確動作是：明說這是品味題 → 給 2-3 個具體選項附取捨 → 問使用者或依 judgment-rubrics.md 的「該問使用者」判準處理。不要假裝 rubric 能代替品味。
