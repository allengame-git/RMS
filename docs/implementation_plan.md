# 功能實作計畫 (implementation_plan.md)

> 最後更新: 2025-12-30

本文件記錄各功能的需求分析與技術設計。

---

## 目錄

1. [標籤連結功能](#1-標籤連結功能-item-link)
2. [關聯項目功能](#2-關聯項目功能-related-items)
3. [階層式項目結構](#3-階層式項目結構-hierarchical-items)
4. [使用者權限管理](#4-使用者權限管理-user-management)
5. [項目編輯刪除流程](#5-項目編輯刪除流程-item-editdelete)
6. [Rich Text Editor 圖片功能](#6-rich-text-editor-圖片功能)

---

## 1. 標籤連結功能 (Item Link)

### 需求

在 Rich Text Editor 中輸入 Item ID (如 `WQ-1`) 時自動轉換為跨專案連結。

### 技術方案

- **Tiptap Extension**: 自訂 Mark 處理 HTML 渲染
- **自動偵測**: 使用 Regex `[A-Z]+-\d+(-\d+)*`
- **驗證 API**: `GET /api/items/lookup?fullId=XXX`

### 檔案結構

```
src/components/editor/
├── extensions/ItemLink.ts        # Tiptap Extension
└── plugins/
    ├── itemLinkPlugin.ts         # 自動偵測
    └── itemLinkValidationPlugin.ts # API 驗證
```

### 狀態: ✅ 已完成

---

## 2. 關聯項目功能 (Related Items)

### 需求

在項目詳情頁下方可手動新增/移除關聯項目。

### Schema 變更

```prisma
model Item {
  relatedItems    Item[] @relation("ItemRelations")
  relatedToItems  Item[] @relation("ItemRelations")
}
```

### Server Actions

- `addRelatedItem(itemId, targetFullId)`
- `removeRelatedItem(itemId, targetId)`

### UI 元件

`RelatedItemsManager.tsx`: 輸入 ID + 列表管理

### 狀態: ✅ 已完成

---

## 3. 階層式項目結構 (Hierarchical Items)

### 需求

顯示完整的 Item 樹狀結構，支援建立子項目。

### 技術方案

- **Utility**: `buildItemTree()` 將扁平陣列轉為樹
- **元件**: `ItemTree` 遞迴渲染
- **操作**: 每個 Item 旁顯示 "+" 按鈕建立子項目

### 整合位置

- Project Detail: 顯示該專案的完整樹
- Item Detail: 左側導覽選單

### 狀態: ✅ 已完成

---

## 4. 使用者權限管理 (User Management)

### 權限矩陣

| 功能 | VIEWER | EDITOR | INSPECTOR | ADMIN |
|------|:------:|:------:|:---------:|:-----:|
| 瀏覽項目 | ✅ | ✅ | ✅ | ✅ |
| 提交變更 | ❌ | ✅ | ✅ | ✅ |
| 審核變更 | ❌ | ❌ | ✅ | ✅ |
| 管理使用者 | ❌ | ❌ | ❌ | ✅ |

### Server Actions (`src/actions/users.ts`)

- `getUsers()`: 取得使用者列表
- `createUser(username, password, role)`
- `updateUser(id, data)`
- `deleteUser(id)`

### UI

- 路徑: `/admin/users`
- 功能: 列表、新增、編輯 (含密碼重設)、刪除 (不可刪自己)

### 狀態: ✅ 已完成

---

## 5. 項目編輯刪除流程 (Item Edit/Delete)

### 需求

Editor/Inspector/Admin 可申請編輯或刪除 Item，需經審核。

### ChangeRequest 類型擴充

- `CREATE`: 新增項目
- `UPDATE`: 編輯 (Title, Content, Attachments)
- `DELETE`: 刪除

### 刪除防呆

```typescript
// 檢查是否有子項目
if (childCount > 0) {
  禁止刪除，顯示提示
}
```

### 前端元件

- `EditItemButton.tsx`: Modal + RichTextEditor
- `DeleteItemButton.tsx`: 確認對話框 + 防呆

### 狀態: ✅ 已完成

---

## 6. Rich Text Editor 圖片功能

### 需求

支援圖片上傳、貼上、拖放至編輯器。

### 技術方案

| 功能 | 實作方式 |
|------|----------|
| 上傳按鈕 | 隱藏 `<input type="file">` + 點擊觸發 |
| 貼上 | `handlePaste` 攔截剪貼簿圖片 |
| 拖放 | `handleDrop` 攔截拖放事件 |
| 上傳 | 呼叫 `/api/upload` 後插入 URL |

### 問題解決

| 問題 | 解決方案 |
|------|----------|
| window.prompt() 閃退 | 改用 React InputDialog |
| Modal 被遮擋 | createPortal 至 body |
| 背景透明 | 使用正確 CSS 變數 |

### 狀態: ✅ 已完成

---

## 待開發功能

### Phase 4.4: 系統優化

- [ ] 前端介面美化 (Rich Aesthetics)
- [ ] 全系統整合測試
- [ ] 使用說明文件 (Walkthrough)
- [ ] 效能優化
