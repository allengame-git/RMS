# NextSteps - 後續工作說明

> 此文件供後續接手的 AI Agent 或開發者了解當前狀態與待辦事項。
> 最後更新：2026-03-12

---

## 最近完成的變更 (v2.1.7)

### 1. Item 編號預分配 (`fullId` 提交即給定)

**問題**：使用者反映 item 編號依照審核通過順序而非提交順序給定。

**修改檔案**：
- `src/actions/approval.ts` — `submitCreateItemRequest` 提交時呼叫 `generateNextItemId()` 預分配 `fullId`，寫進 `ChangeRequest.data` JSON
- `src/actions/approval.ts` — `handleItemCreateApproval` 優先用 `data.fullId`，fallback 動態產生（相容舊 pending requests）
- `src/actions/approval.ts` — `ApprovalData` interface 新增 `fullId?: string`
- `src/lib/item-utils.ts` — `generateNextItemId` 的 pending request 檢查邏輯現在正確運作（之前 `data.fullId` 永遠是 undefined）

**注意事項**：
- 已排隊的舊 ChangeRequest 沒有 `fullId`，不需手動處理，`handleItemCreateApproval` 有 fallback
- 若兩人同時提交到同一個 parent，可能產生 `fullId` 衝突（Prisma UNIQUE constraint 會阻擋）。目前 `generateNextItemId` 會查 pending requests 避免此問題，但極端高並發下仍有風險

### 2. Sidebar 過濾已刪除 Item

**問題**：瀏覽 item 時左側 sidebar 會顯示已刪除的 item。

**修改檔案**：
- `src/app/items/[id]/layout.tsx` — `prisma.item.findMany` 的 where 條件加入 `isDeleted: false`

### 3. 審查頁面 Detail Panel 位置

**問題**：點擊 card 後審查資訊視窗出現在所有 card 最下方，使用者需大幅捲動。

**修改檔案**：
- `src/components/approval/ApprovalList.tsx`
  - Detail panel 移入 CSS Grid 內部
  - 每張 card 加上 `order: index`
  - Detail panel 加上 `gridColumn: "1 / -1"` + `order: expandedIndex`
  - 新增 `useRef` + `useEffect` 自動 `scrollIntoView`

---

## 建議的後續工作

### 高優先級

1. **`fullId` 並發衝突保護**
   - 目前 `submitCreateItemRequest` 在 transaction 外產生 `fullId`，極端並發下可能重複
   - 考慮在 `generateNextItemId` 使用 SELECT ... FOR UPDATE 鎖定或在 DB 層加 retry 邏輯
   - 或改回 transaction 內產生但保持提交時間戳排序

2. **DataFileApprovalList 同步修改**
   - `src/components/datafile/DataFileApprovalList.tsx` 可能有同樣的 detail panel 位置問題
   - 建議比照 `ApprovalList.tsx` 的 CSS Grid order 方式修改

3. **QCDocumentApprovalList 同步修改**
   - `src/components/approval/QCDocumentApprovalList.tsx` 同上

### 中優先級

4. **項目 Sidebar 即時更新**
   - 目前 sidebar 資料在 `layout.tsx` (Server Component) 取得，刪除/新增 item 後需重載整個 layout 才會更新
   - 可考慮用 `revalidatePath` 或 client-side SWR 方式即時更新 sidebar

5. **審查頁面 Card Grid 空洞**
   - CSS Grid order 方式在某些排列下可能產生空格（例如第一張 card 展開時，同行剩餘位置為空）
   - 可考慮用 `display: flex; flex-wrap: wrap` 替代或微調 grid 行為

6. **批量審核功能**
   - 使用者可能需要一次審核多筆申請，目前只能逐筆操作

### 低優先級

7. **審查頁面效能**
   - 大量 pending requests 時 `JSON.parse(req.data)` 在每次 render 都會執行
   - 可用 `useMemo` 快取 parsed data

8. **Sidebar 搜尋/篩選**
   - 項目數量多時 sidebar 過長，可加入搜尋或篩選功能

---

## 相關檔案索引

| 功能 | 主要檔案 |
|------|----------|
| Item 建立審核流程 | `src/actions/approval.ts` |
| Item 編號生成 | `src/lib/item-utils.ts` |
| 審查頁面 UI | `src/components/approval/ApprovalList.tsx` |
| 項目 Sidebar | `src/components/item/SidebarNav.tsx`, `src/app/items/[id]/layout.tsx` |
| 樹狀結構工具 | `src/lib/tree-utils.ts` |
| QC 審查 | `src/components/approval/QCDocumentApprovalList.tsx`, `src/actions/qc-approval.ts` |
| 檔案審查 | `src/components/datafile/DataFileApprovalList.tsx` |
