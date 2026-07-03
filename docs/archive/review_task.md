# 審核流程通知與退回機制 - 工作任務清單

> 最後更新: 2026-01-08

## 進度總覽

| Phase | 說明 | 狀態 |
|-------|------|------|
| Phase 1 | 通知系統 | ✅ 完成 |
| Phase 2 | QC/PM 退回重新提交機制 | ✅ 完成 |
| Phase 3 | PDF 歷程紀錄 | ✅ 完成 |
| Phase 4 | 變更申請退回優化 | ✅ 完成 |

---

## Phase 1: 通知系統 ✅

### Task 1.1: Notification 資料模型建立 ✅

- [x] 在 `prisma/schema.prisma` 新增 `Notification` 模型
- [x] 執行 `prisma db push` 建立資料表
- [x] 建立 `src/actions/notifications.ts` Server Actions
  - [x] `createNotification(userId, type, title, message, link?)`
  - [x] `getNotifications(userId, limit?)`
  - [x] `markAsRead(notificationId)`
  - [x] `markAllAsRead(userId)`
  - [x] `getUnreadCount(userId)`

### Task 1.2: NotificationBell UI 元件 ✅

- [x] 建立 `src/components/layout/NotificationBell.tsx`
  - [x] 鈴鐺圖示 + 未讀數量 Badge
  - [x] 點擊展開下拉選單
  - [x] 顯示最新 10 筆通知 (內建於同一元件)
  - [x] 點擊標記已讀 + 跳轉連結
  - [x] 「全部標記已讀」按鈕
  - [x] 「查看全部」連結
- [x] 整合至 `Navbar.tsx` 導覽列

### Task 1.3: 通知頁面 ✅

- [x] 建立 `/notifications` 頁面 (`src/app/notifications/page.tsx`)
  - [x] 完整通知列表 (`NotificationList.tsx`)
  - [x] 已讀/未讀篩選
  - [x] 時間排序

### Task 1.4: 整合 rejectRequest 觸發通知 ✅

- [x] 修改 `src/actions/approval.ts` 的 `rejectRequest`
  - [x] 查詢 ChangeRequest 的 submittedById
  - [x] 呼叫 `createNotification` 發送退回通知
  - [x] 通知內容包含：項目編號、審查意見

### Task 1.5: 整合核准通知 ✅

- [x] 修改 `approveRequest` 發送核准通知
- [x] 修改 `approveAsPM` 發送完成通知

---

## Phase 2: QC/PM 退回重新提交機制 ✅

### Task 2.1: 資料模型擴充 ✅

- [x] 在 `prisma/schema.prisma` 修改 `QCDocumentApproval`
  - [x] 新增 `revisionCount` 欄位 (Int, default 0)
  - [x] 修改 `status` 新增 `REVISION_REQUIRED` 選項
- [x] 新增 `QCDocumentRevision` 模型
  - [x] `approvalId`, `revisionNumber`, `requestedById`
  - [x] `requestedAt`, `requestNote`
  - [x] `resolvedAt`, `resolvedItemHistoryId`
- [x] 執行 `prisma db push`

### Task 2.2: rejectQCDocument 改為退回流程 ✅

- [x] 修改 `src/actions/qc-approval.ts` 的 `rejectQCDocument`
  - [x] 狀態改為 `REVISION_REQUIRED` (非 `REJECTED`)
  - [x] 建立 `QCDocumentRevision` 紀錄
  - [x] 發送通知給 Editor (附帶修改意見)
- [x] 新增 `getRevisionRequiredDocuments(userId)` 查詢待修改文件

### Task 2.3: Editor 修改介面 ✅

- [x] 建立 `/admin/revisions` 頁面 - 待修改文件清單
- [x] 建立 `RevisionRequiredCard.tsx` 元件
  - [x] 顯示退回意見
  - [x] 「檢視原始版本」連結
  - [x] 「修改內容」按鈕 (帶 `revisionId` 參數)
- [x] 手動流程可運作：Editor 可從 `/admin/revisions` 點擊修改，完成後再呼叫 `resubmitForReview`

> **可選優化** (後續版本)：
>
> - 自動偵測待修改的 QCDocumentApproval
> - 編輯提交後自動關聯並呼叫 resubmitForReview

### Task 2.4: 重新提交審核流程 ✅

- [x] 新增 `resubmitForReview(approvalId, newItemHistoryId)`
  - [x] 更新 `QCDocumentRevision.resolvedAt`
  - [x] 更新 `QCDocumentApproval.status` 回 `PENDING_QC`
  - [x] 增加 `revisionCount`
- [x] 核心 API 已完成，可透過前端或 API 呼叫觸發

> **可選優化** (後續版本)：
>
> - `createHistoryRecord` 自動偵測並觸發重新提交

### Task 2.5: 狀態顯示優化 ✅

- [x] 修改 `/iso-docs` 頁面
  - [x] 顯示 `REVISION_REQUIRED` 狀態標籤
  - [x] 顯示修訂次數
- [x] 修改 Approval Dashboard
  - [x] 區分首次審核與重新審核

---

## Phase 3: PDF 歷程紀錄 ✅

### Task 3.1: PDF 修訂歷程區塊 ✅

- [x] 修改 `src/lib/pdf-generator.ts` 的 `generateHistoryPagePDF`
  - [x] 查詢關聯的 `QCDocumentRevision` 紀錄
  - [x] 新增「修訂歷程」HTML 區塊
  - [x] 表格欄位：版次、退回者、修改要求、完成時間
- [x] 調整 CSS 樣式

### Task 3.2: 歷史頁面審查紀錄優化 ✅

- [x] 修改 `src/app/admin/history/detail/[id]/page.tsx`
  - [x] 查詢相關 `QCDocumentRevision` 紀錄
  - [x] 在「審查紀錄詳情」區塊顯示完整審核過程
  - [x] 顯示各階段退回/重新提交紀錄
  - [x] 顯示每次退回的原因與修改說明
- [x] 建立 `ReviewProcessTimeline.tsx` 元件
  - [x] 垂直時間軸設計
  - [x] 各節點顯示：審核者、時間、結果、意見

### Task 3.3: 變更內容比對簡化 ✅

- [x] 確認歷史頁面 Diff 僅比對「前一版本」與「本次最終核定版本」
- [x] 移除或隱藏中間修訂版本的 Diff 連結
- [x] 簡化視覺呈現，聚焦於最終結果

---

## 驗收清單

### Phase 1 驗收

- [ ] Inspector 拒絕變更申請 → Editor 導覽列鈴鐺顯示未讀
- [ ] 點擊通知 → 跳轉至對應項目/申請頁面
- [ ] 通知可標記已讀

### Phase 2 驗收

- [ ] QC 退回品質文件 → 狀態顯示「需修改」
- [ ] Editor 收到通知 (含 QC 意見)
- [ ] Editor 修改內容後重新提交
- [ ] 文件狀態回到「待 QC 審核」
- [ ] 修訂計數器正確增加

### Phase 3 驗收

- [ ] 品質文件 PDF 包含修訂歷程表格
- [ ] 歷史詳情頁「審查紀錄詳情」顯示完整審核過程
- [ ] 變更內容僅比對前一版與最終核定版

---

## Phase 4: 變更申請退回優化 (Rejected Request) ✅

### Task 4.1: 待修改申請專屬頁面 ✅

- [x] Server Actions: `getRejectedRequests`, `getRejectedRequestDetail`
- [x] 頁面: `/admin/rejected-requests` (列表)
- [x] 頁面: `/admin/rejected-requests/[id]` (詳情與編輯)
- [x] 編輯表單: `RejectedRequestEditForm.tsx` (自動帶入上次提交內容、附件、關聯項目)

### Task 4.2: 重新提交流程整合 ✅

- [x] 表單提交後呼叫 `submitUpdateItemRequest`
- [x] 新增 `markRejectedAsResubmitted` 清除原退回紀錄
- [x] 更新 `rejectRequest` 通知連結導向專屬頁面

### Task 4.3: 導覽列整合 ✅

- [x] 新增 `/api/rejected-count` API
- [x] Navbar 新增「待修改」連結與計數 Badge

### Phase 4 驗收

- [ ] 變更申請被退回 → Navbar 待修改 Badge 顯示數量
- [ ] 點擊通知或 Badge → 進入 `/admin/rejected-requests`
- [ ] 編輯表單自動帶入上次內容 (含附件、關聯)
- [ ] 重新提交成功 → 原退回項目消失 (狀態更新)
