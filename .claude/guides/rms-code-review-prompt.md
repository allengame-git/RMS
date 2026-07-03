# Code Review Prompt — LLRWD-RMS 完整審查

> **使用前提：** 開一個全新的 Claude Code session（或執行 `/clear`），確保沒有任何開發歷史的 context 污染。
>
> **Sub-agents 位置：** `.claude/agents/` 目錄（rms-security-reviewer, rms-backend-reviewer, rms-frontend-reviewer, rms-architecture-reviewer）

---

## 快速啟動（單一 prompt，啟動所有 sub-agents）

```
請對整個 LLRWD-RMS codebase 進行完整的 code review。

依序使用以下 4 個 sub-agent，每個都在獨立的 context 中執行：

1. 使用 rms-security-reviewer sub-agent 審查安全問題
2. 使用 rms-backend-reviewer sub-agent 審查後端品質（重點：fullId cascade、審批 pipeline、Server Actions）
3. 使用 rms-frontend-reviewer sub-agent 審查前端品質（重點：RSC、Tiptap、Server Action 整合）
4. 使用 rms-architecture-reviewer sub-agent 審查跨層架構一致性

每個完成後，將報告存到 `.claude/review-reports/` 目錄（以今天日期命名，如 `2026-03-25-security.md`）。

全部完成後，輸出 `REVIEW-SUMMARY.md` 整合報告，包含：
- 所有 Critical 和 High 問題的彙整
- 修復優先順序（1–10 排序）
- 整體 codebase 健康度評估
```

---

## 分開執行（各 agent 獨立 prompt）

---

### 🔐 安全審查

```
開新 session。請使用 rms-security-reviewer sub-agent（位於 .claude/agents/rms-security-reviewer.md）對整個 codebase 進行安全審查。

重點審查路徑：
- src/middleware.ts（Edge Middleware 覆蓋範圍）
- src/actions/（所有 server actions 的 getServerSession + 角色驗證）
- src/actions/approval.ts（自我審批防護：submittedBy !== reviewedBy）
- src/actions/qc-approval.ts（isQC / isPM flag 驗證）
- src/app/api/datafiles/upload 和 src/app/api/upload（upload auth 繞過風險）
- src/app/api/admin/restore/（Zip Slip 防護、ADMIN 權限）
- src/lib/backup-utils.ts（SQL dump 安全性）

特別重點：
1. Upload routes 被排除在 Edge Middleware 外，確認每個 upload route 都有 `getServerSession` 驗證
2. Admin restore 的 SQL injection 防護
3. JWT cookie 設定（httpOnly, secure, sameSite）
4. isPM / isQC flag 是否每次都從 DB 重新驗證（而非只靠 JWT payload）

輸出：結構化安全審查報告 + 安全評分（0-100）。
```

---

### 🖥️ 後端審查

```
開新 session。請使用 rms-backend-reviewer sub-agent（位於 .claude/agents/rms-backend-reviewer.md）對後端進行完整審查。

重點審查路徑：
- src/lib/fullid-cascade.ts（兩階段重命名邏輯）
- src/lib/item-utils.ts（generateNextItemId 並發安全性）
- src/actions/approval.ts（審批狀態機完整性）
- src/actions/qc-approval.ts（processSinglePMApproval 唯一入口確認）
- src/actions/item-reorder.ts（collect → cascade 呼叫順序）
- src/lib/backup/（project 匯出入的 ID mapping）
- src/app/api/admin/restore/database/route.ts（FK 重建順序）
- src/lib/pdf-generator.ts（formatDiffValue、字型 subsetting）

特別重點：
1. 執行：grep -rn "batchCascadeFullIdChanges" src/ — 確認每個呼叫前都有 collectDescendantChanges
2. 追蹤審批狀態機：所有狀態轉換是否有 current state 驗證
3. processSinglePMApproval 是否真的是唯一的 PM 審批入口
4. 軟刪除 restore 後 __DELETED_ 前綴是否正確移除且無衝突

輸出：結構化後端審查報告 + fullId Cascade 安全性評估 + 審批 Pipeline 狀態機分析。
```

---

### ⚛️ 前端審查

```
開新 session。請使用 rms-frontend-reviewer sub-agent（位於 .claude/agents/rms-frontend-reviewer.md）對前端進行完整審查。

重點審查路徑：
- src/app/（所有 page.tsx — 確認 RSC vs Client Component 正確使用）
- src/app/items/[id]/layout.tsx（sidebar data fetch 策略）
- src/components/editor/ItemLink.ts（InputRule + ITEM_ID_CORE_PATTERN）
- src/components/editor/itemLinkPlugin.ts（docChanged guard 效能）
- src/contexts/ThemeContext.tsx（theme 持久化）
- src/stores/sidebarStore.ts（Zustand collapse state）

特別重點：
1. 比對 ItemLink.ts 和 itemLinkPlugin.ts 的 regex — ITEM_ID_CORE_PATTERN 是否真的共用同一個常數？
2. 所有使用 server action 的表單是否有 loading state 防止重複提交
3. 審批操作（approve/reject）是否有 confirmation dialog
4. 軟刪除 Item 在前端所有列表是否都被正確過濾（isDeleted: false）

輸出：結構化前端審查報告 + Tiptap regex 同步狀態 + Server Action 表單一致性報告。
```

---

### 🏗️ 架構審查

```
開新 session。請使用 rms-architecture-reviewer sub-agent（位於 .claude/agents/rms-architecture-reviewer.md）對整體架構進行審查。

重點任務（按順序）：

Task 1：審批 Pipeline 端對端追蹤
追蹤一個 ChangeRequest 從 PENDING → PENDING_QC → PENDING_PM → PDF 完成的完整流程，確認每個狀態轉換的驗證和 DB 操作。

Task 2：fullId Cascade 呼叫點審計
執行：grep -rn "batchCascadeFullIdChanges" src/
逐一確認每個呼叫前是否都有 collectDescendantChanges()。

Task 3：軟刪除過濾覆蓋率掃描
執行：grep -rn "prisma\.item\.findMany\|prisma\.dataFile\.findMany" src/
確認所有查詢是否都有 isDeleted: false 過濾。

Task 4：設計決策合規掃描
- grep -rn "ITEM_ID_CORE_PATTERN" — 確認只被兩個地方引用
- grep -rn "getServerSession" src/app/api/ — 確認 upload routes 都有驗證
- grep -rn "processSinglePMApproval" — 確認 PM 審批的唯一入口

輸出：架構審查報告（含 pipeline 完整性、cascade 安全性、軟刪除一致性、設計決策合規結果、架構健康度評分）。
```

---

## 審查後的後續操作

```
# 修復 Critical 問題
請閱讀 .claude/review-reports/ 下的所有報告，
列出所有 Critical 問題，按照以下優先順序排列：
  1. 安全漏洞（未授權存取、SQL injection）
  2. 資料完整性（fullId cascade bug、審批狀態機漏洞）
  3. 功能正確性（軟刪除過濾遺漏）
  4. 效能問題（N+1、無限增長 table）
  5. 程式碼品質

逐一修復，每修完一個用對應 sub-agent 重新驗證。

# 建立修復 Checklist
將所有 High 以上問題轉換為 GitHub Issue 格式，存到 .claude/review-reports/FIX-CHECKLIST.md

# 核心流程回歸測試
修復後確認以下流程端對端正常：
1. 登入 → EDITOR 提交變更 → INSPECTOR 審查 → QC 批准 → PM 批准 → PDF 生成
2. 重排 item → 所有後代 fullId 正確更新 → Tiptap 連結指向新 fullId
3. 軟刪除 item → 所有列表不顯示 → restore → fullId 恢復無衝突
4. 上傳檔案 → MIME 驗證 → UUID 重命名 → 正確儲存
```

---

## 注意事項

| 事項 | 說明 |
|------|------|
| **必須開新 session** | 避免 context 污染 |
| **只審查，不修改** | 審查 session 只輸出報告；修復另開 session |
| **審查順序建議** | security → backend → frontend → architecture |
| **RMS 特有重點** | fullId cascade 的 collect→cascade 順序是最高風險業務邏輯 |
| **審批流程測試** | 架構審查完成後，務必做一次完整的審批 pipeline 手動測試 |
