# NextSteps - 後續工作說明

> 此文件供後續接手的 AI Agent 或開發者了解當前狀態與待辦事項。
> 最後更新：2026-03-25

---

## 最近完成的變更 (v2.2.1)

### 10. 程式碼重構 (2026-03-21)

**修改檔案**：
- `src/actions/qc-approval.ts` — 提取 `processSinglePMApproval()` 共用函式，`approveAsPM` 與 `batchApproveAsPM` 共用，減少 78 行；三個獨立 DB 查詢改用 `Promise.all` 平行化
- `src/components/approval/QCDocumentApprovalList.tsx` — 移除無用的 `batchProgress` state（done counter 從未遞增）
- `src/components/editor/plugins/itemLinkPlugin.ts` — 提取 `buildDecorations()` 函式，加入 `docChanged` 守衛避免游標移動觸發全文 regex 掃描；fullId regex 改用共用常數 `ITEM_ID_CORE_PATTERN`
- `src/components/editor/extensions/ItemLink.ts` — 引用共用 `ITEM_ID_CORE_PATTERN` 取代內聯 regex
- `src/lib/pdf-generator.ts` — `stripHtml` 提升為 module scope，移除不必要的參數

**設計要點**：
- `ITEM_ID_CORE_PATTERN` 從 `itemLinkPlugin.ts` export，`ItemLink.ts` import 使用，確保兩處 regex 永遠同步
- `docChanged` 守衛：ProseMirror plugin 的 `apply` 方法在每次 transaction 都會觸發（包含純游標移動），加入 `if (!tr.docChanged) return old` 可避免無意義的全文掃描

### 6. PM 品質文件批次核准

**修改檔案**：
- `src/actions/qc-approval.ts` — 新增 `batchApproveAsPM` Server Action，逐筆處理 PDF 生成與 DB 更新，per-item 錯誤處理
- `src/components/approval/QCDocumentApprovalList.tsx` — 新增 checkbox 多選 UI、全選、批次核准確認對話框

**設計要點**：
- PDF 在 DB 更新之前生成，確保 PDF 失敗不會造成 DB 狀態不一致
- 失敗項目保持 `PENDING_PM` 狀態，可再次單獨或批次核准
- 批次處理中所有按鈕（checkbox、核准、駁回）均禁用

### 7. QC PDF diff 人類可讀顯示

- `src/lib/pdf-generator.ts` — 新增 `formatDiffValue()` 函式
- `relatedItems` 顯示為 `fullId - 標題` 格式，`references` 顯示為 `dataCode - 名稱`，不再 `JSON.stringify`

### 8. ItemLink 多段 codePrefix 修復

- `src/components/editor/extensions/ItemLink.ts` — InputRule regex 改為 `((?:[A-Z]+-)+\d+(?:-\d+)*)`
- `src/components/editor/plugins/itemLinkPlugin.ts` — decoration regex 同步更新
- 修復 `RMS-DAREN-4-1` 只辨識到 `DAREN-4-1` 的問題

### 9. 檔案上傳 >10MB 修復

- `src/middleware.ts` — 排除 `/api/datafiles/upload` 和 `/api/upload` 於 Edge middleware matcher
- Edge middleware 有 10MB body 限制，超過會截斷 request body 導致 FormData 解析失敗

---

## 先前完成的變更 (v2.2.0)

### 1. 項目排序 / 移動 / 重新編號

**核心實作**：
- `src/actions/item-reorder.ts` — `reorderItems`, `moveItem`, `renumberItems` 三個 Server Actions
- `src/lib/fullid-cascade.ts` — fullId 級聯更新工具，含兩階段 `__TEMP_` 前綴機制與 `__DELETED_` 前綴處理軟刪除衝突
- `src/components/item/ReorderDialog.tsx`, `MoveItemDialog.tsx`, `RenumberDialog.tsx` — UI 對話框

**注意事項**：
- `collectDescendantChanges()` 必須在 `batchCascadeFullIdChanges()` **之前**呼叫，否則子項目 fullId 已被改變，無法正確記錄 before/after
- 操作前會檢查 PENDING ChangeRequest，有待審核項目時阻擋操作

### 2. 待審核申請編輯功能

**修改檔案**：
- `src/actions/approval.ts` — `updatePendingRequest` Server Action（驗證登入、PENDING 狀態、原提交者）
- `src/components/approval/EditPendingRequestModal.tsx` — 編輯 Modal（RichTextEditor + RelatedItems + References）
- `src/components/approval/ApprovalList.tsx` — 新增「編輯申請」按鈕

### 3. 刪除原因必填

- `src/components/item/DeleteItemButton.tsx` — 新增 deleteReason textarea，確認按鈕在未填寫時禁用
- `src/actions/approval.ts` — `submitDeleteItemRequest` 接受 reason 參數

### 4. 資料庫復原序列自動重置

- `src/app/api/admin/restore/database/route.ts` — 還原後自動執行 `setval` 重置所有 `_id_seq` 序列

### 5. 歷史紀錄標籤中文化

- 所有歷史頁面統一 REORDER → 排序、RESTORE → 還原，含對應顏色（紫色、橙色）
- 涉及檔案：`src/app/items/[id]/page.tsx`, `src/app/admin/history/[projectId]/item/[fullId]/page.tsx`, `src/app/admin/history/detail/[id]/page.tsx`, `src/components/history/RecentUpdatesTable.tsx`

---

## 建議的後續工作

### 高優先級

1. **`fullId` 並發衝突保護**
   - `submitCreateItemRequest` 在 transaction 外產生 `fullId`，極端並發下可能重複
   - 考慮在 `generateNextItemId` 使用 SELECT ... FOR UPDATE 或 DB 層 retry 邏輯

2. **DataFileApprovalList / QCDocumentApprovalList 同步修改**
   - 審查頁面 detail panel 位置問題（CSS Grid order 方式）
   - `src/components/datafile/DataFileApprovalList.tsx`
   - `src/components/approval/QCDocumentApprovalList.tsx`

3. **Windows 部署 `core.symlinks` 問題**
   - 部分 Windows 環境 `git config core.symlinks` 為 `false`，導致 `[id]` 等動態路由資料夾在 clone 時出錯
   - 建議在部署文件中補充：需啟用 Git symlinks 支援或以管理員權限 clone

### 中優先級

4. **項目 Sidebar 即時更新**
   - sidebar 資料在 `layout.tsx` (Server Component) 取得，刪除/新增 item 後需重載才更新
   - 可考慮 `revalidatePath` 或 client-side SWR

5. **審查頁面 Card Grid 空洞**
   - CSS Grid order 方式在某些排列下可能產生空格
   - 可考慮 `display: flex; flex-wrap: wrap` 替代

6. **DataFile 批量審核**
   - 目前僅 QC 品質文件有批次核准，DataFile 審查和 Item 審查尚未支援批次操作

### 低優先級

7. **審查頁面效能**
   - 大量 pending requests 時 `JSON.parse(req.data)` 每次 render 執行
   - 可用 `useMemo` 快取

8. **Sidebar 搜尋/篩選**
   - 項目數量多時 sidebar 過長

---

## 相關檔案索引

| 功能 | 主要檔案 |
|------|----------|
| Item 排序/移動/重新編號 | `src/actions/item-reorder.ts` |
| fullId 級聯更新 | `src/lib/fullid-cascade.ts` |
| 已刪除項目管理 | `src/app/admin/deleted-items/page.tsx`, `src/actions/item-reorder.ts` (restoreItem) |
| 待審核申請編輯 | `src/components/approval/EditPendingRequestModal.tsx`, `src/actions/approval.ts` |
| Item 建立審核流程 | `src/actions/approval.ts` |
| Item 編號生成 | `src/lib/item-utils.ts` |
| 審查頁面 UI | `src/components/approval/ApprovalList.tsx` |
| 項目 Sidebar | `src/components/item/SidebarNav.tsx`, `src/app/items/[id]/layout.tsx` |
| 樹狀結構工具 | `src/lib/tree-utils.ts` |
| QC 審查 | `src/components/approval/QCDocumentApprovalList.tsx`, `src/actions/qc-approval.ts` |
| 檔案審查 | `src/components/datafile/DataFileApprovalList.tsx` |
| 備份還原 | `src/app/api/admin/restore/database/route.ts`, `src/lib/backup-utils.ts` |
| 項目刪除 | `src/components/item/DeleteItemButton.tsx` |
| PDF 生成 | `src/lib/pdf-generator.ts` |
| ItemLink 擴充 | `src/components/editor/extensions/ItemLink.ts`, `src/components/editor/plugins/itemLinkPlugin.ts` |
