# PENDING 申請編輯功能設計

## 目標

讓提交者在審查同意前，可以直接編輯 PENDING 狀態的 ChangeRequest 內容並重新提交，避免撤回後全部資料要重新輸入。

## 流程

1. 提交者在審查區看到自己的 PENDING 申請，除了「撤回」按鈕，多一個「編輯」按鈕
2. 點擊「編輯」→ 開啟 Modal，表單預填當前 ChangeRequest.data 的內容
3. 修改後點擊「重新提交」→ 直接更新同一筆 ChangeRequest 的 `data`、`submitReason`、`updatedAt`
4. 頁面刷新，審核者看到更新後的內容

## 支援類型

- CREATE（新增項目）
- UPDATE（編輯項目）

## 後端

新增 Server Action：`updatePendingRequest(requestId: number, formData: FormData)`

- 驗證：登入、status === "PENDING"、submittedById === 當前使用者
- 更新 `data`（JSON）、`submitReason`、`updatedAt`
- revalidate 相關路徑

## 前端

- `ApprovalList.tsx`：提交者操作區新增「編輯」按鈕（在「撤回」旁邊）
- 新增 `EditPendingRequestModal` 元件
  - CREATE：標題、內容、關聯項目、參考文獻、提交原因
  - UPDATE：同上
  - 複用 RichTextEditor、RelatedItemsManager、ReferencesManager
- Modal 結構類似 EditItemButton，資料來源是 ChangeRequest.data

## 權限

- 只有原提交者本人可以編輯（submittedById === session.user.id）
- ADMIN 不可代替他人編輯（編輯涉及內容責任）

## 資料處理

- 直接更新原 ChangeRequest 記錄（同一筆 ID）
- 不建立新記錄、不保留舊版本
