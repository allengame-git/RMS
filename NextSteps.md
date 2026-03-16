# NextSteps - 後續工作說明

> 此文件供後續接手的 AI Agent 或開發者了解當前狀態與待辦事項。
> 最後更新：2026-03-16

---

## 最近完成的變更 (v2.2.0)

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

6. **批量審核功能**
   - 一次審核多筆申請，目前只能逐筆操作

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
