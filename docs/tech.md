# 技術文件 - 專案項目資訊管理系統 (tech.md)

> 最後更新: 2025-12-30

## 專案資訊

| 項目 | 說明 |
|------|------|
| **專案名稱** | 專案項目資訊管理系統 (RMS) |
| **技術棧** | Next.js 14, TypeScript, Prisma, SQLite, NextAuth.js |
| **樣式方案** | Vanilla CSS + CSS Variables |
| **編輯器** | Tiptap (ProseMirror-based) |

---

## 系統架構

### 資料模型 (Prisma Schema)

```
User ──┬── ChangeRequest (submitter)
       └── ChangeRequest (reviewer)

Project ──── Item (1:N)
             │
             └── Item (self-relation, parent/child)
                 │
                 ├── ChangeRequest
                 └── Item-Item (M:N, relatedItems)
```

### 核心模型

| Model | 用途 |
|-------|------|
| `User` | 使用者帳號、角色、認證 |
| `Project` | 專案根節點，包含 prefix |
| `Item` | 階層式項目，支援父子關聯與自動編號 |
| `ChangeRequest` | 變更申請暫存區，支援 CREATE/UPDATE/DELETE |

---

## Phase 1: 基礎建設

### 資料庫 (Prisma + SQLite)

- **SQLite 限制**: 不支援原生 Enum，改用 String + 應用程式常數
- **密碼安全**: 使用 `bcryptjs` 雜湊處理

### 身份驗證 (NextAuth.js)

- **Provider**: Credentials (Username/Password)
- **Session 擴充**: 加入 `role` 與 `id` 欄位
- **型別安全**: 擴充 `next-auth.d.ts`

### UI 設計系統

- **CSS Variables**: 定義於 `:root`，支援主題切換
- **主題切換**: 使用 `data-theme` 屬性 + `localStorage`

---

## Phase 2: 核心功能

### 自動編號邏輯 (`lib/item-utils.ts`)

```
根項目: PROJECT-1, PROJECT-2, ...
子項目: PARENT-1, PARENT-2, ...
範例:  WQ-1 → WQ-1-1 → WQ-1-1-1
```

### 審核流程 (Change Request)

| 狀態 | 說明 |
|------|------|
| `PENDING` | 待審核 |
| `APPROVED` | 已核准 (寫入 Item) |
| `REJECTED` | 已退回 |

**流程**:

1. Editor 提交 → 寫入 ChangeRequest (PENDING)
2. Inspector/Admin 審核 → 執行操作 → 更新狀態

---

## Phase 3: 進階功能

### Rich Text Editor (Tiptap)

**安裝套件**:

- `@tiptap/react`, `@tiptap/starter-kit`
- `@tiptap/extension-image`, `@tiptap/extension-link`
- `@tiptap/extension-table` 系列

**SSR 相容性**:

```typescript
useEditor({ immediatelyRender: false })
```

### 檔案上傳

| 設定 | 值 |
|------|------|
| API 路徑 | `/api/upload` |
| 儲存位置 | `/public/uploads/[year]/[month]/` |
| 大小限制 | 20MB |
| 允許類型 | PDF, DOC, DOCX, JPG, PNG, GIF, WEBP |

### 標籤連結 (Item Link)

**格式**: `[A-Z]+-\d+(-\d+)*` (e.g., `WQ-1`, `PRJ-2-1`)

**元件**:

- `ItemLink.ts`: Tiptap Extension
- `itemLinkPlugin.ts`: 自動偵測 Plugin
- `itemLinkValidationPlugin.ts`: API 驗證 Plugin

**API**: `GET /api/items/lookup?fullId=XXX`

### 關聯項目 (Related Items)

**Schema**: Self-relation Many-to-Many

```prisma
relatedItems    Item[] @relation("ItemRelations")
relatedToItems  Item[] @relation("ItemRelations")
```

**Server Actions**: `addRelatedItem`, `removeRelatedItem`

---

## Phase 4: 優化與擴充

### 4.0 主題切換

- **檔案**: `globals.css` (淺色), `theme.css` (深色覆蓋)
- **選擇器**: `html[data-theme="dark"]`
- **優先級**: 使用 `!important`

### 4.1 權限系統

| 角色 | 瀏覽 | 提交變更 | 審核 | 管理使用者 |
|------|:----:|:--------:|:----:|:----------:|
| VIEWER | ✅ | ❌ | ❌ | ❌ |
| EDITOR | ✅ | ✅ | ❌ | ❌ |
| INSPECTOR | ✅ | ✅ | ✅ | ❌ |
| ADMIN | ✅ | ✅ | ✅ | ✅ |

**Server Actions**: `src/actions/users.ts`

- `getUsers`, `createUser`, `updateUser`, `deleteUser`

### 4.2 項目編輯/刪除

**擴充 ChangeRequest 類型**:

- `CREATE`: 新增項目
- `UPDATE`: 編輯項目 (Title, Content, Attachments)
- `DELETE`: 刪除項目

**刪除防呆**: 檢查 `childCount > 0` 則禁止

**前端元件**:

- `EditItemButton.tsx`: 使用 React Portal 解決 z-index 問題
- `DeleteItemButton.tsx`: 根據 childCount 禁用

### 4.3 Rich Text Editor 圖片功能

**問題與解決**:

| 問題 | 原因 | 解決方案 |
|------|------|----------|
| Link/Image 按鈕閃退 | `window.prompt()` 阻塞式對話框與 React 衝突 | 改用 React `InputDialog` 元件 |
| Modal 被遮擋 | CSS Stacking Context | 使用 `createPortal` 渲染至 body |
| 背景半透明 | 錯誤的 CSS 變數 | 改用 `var(--color-bg-surface)` |

**圖片功能**:

- `handlePaste`: 攔截剪貼簿圖片，自動上傳
- `handleDrop`: 攔截拖放圖片，自動上傳
- 上傳按鈕: 選擇檔案後直接上傳

---

## 問題解決記錄

### 常見問題速查

| 問題 | 解決方案 |
|------|----------|
| Tiptap SSR Hydration Error | `immediatelyRender: false` |
| 日期格式不一致 | 使用固定 locale |
| Prisma 類型未更新 | `npx prisma generate` + 重啟 |
| confirm() 對話框閃現 | 改用 React 自訂對話框 |
| Server Component Prisma 錯誤 | 移除 `"use client"` |

### 詳細記錄

#### Tiptap SSR Hydration Error

- **問題**: Next.js SSR 環境下產生 hydration mismatch
- **解決**: `useEditor({ immediatelyRender: false })`

#### Item Link removeChild 錯誤

- **問題**: 快速切換頁面時發生 DOM 錯誤
- **原因**: Plugin 在 update 中直接 dispatch transaction
- **解決**: 改用 `appendTransaction` + `!view.isDestroyed` 檢查

#### Inspector 無法進入審核頁面

- **問題**: Redirect Loop
- **原因**: 權限檢查僅允許 ADMIN
- **解決**: 放寬為 `ADMIN || INSPECTOR`

#### 嵌套表單提交問題

- **問題**: RelatedItemsManager 內的表單提交會導致父表單提交
- **解決**: 將內部 `<form>` 改為 `<div>`，使用 `button type="button"` + `onKeyDown` 處理 Enter

---

## 檔案結構

```
src/
├── app/
│   ├── api/
│   │   ├── upload/route.ts       # 檔案上傳
│   │   └── items/lookup/route.ts # Item 查詢
│   ├── admin/
│   │   ├── approval/page.tsx     # 審核頁面
│   │   └── users/page.tsx        # 使用者管理
│   ├── projects/[id]/page.tsx    # 專案詳情
│   └── items/[id]/page.tsx       # 項目詳情
├── actions/
│   ├── approval.ts               # 審核相關
│   ├── users.ts                  # 使用者管理
│   └── item-relations.ts         # 關聯項目
├── components/
│   ├── editor/
│   │   ├── RichTextEditor.tsx    # 富文本編輯器
│   │   └── extensions/           # Tiptap 擴充
│   ├── item/
│   │   ├── CreateItemForm.tsx
│   │   ├── EditItemButton.tsx
│   │   ├── DeleteItemButton.tsx
│   │   └── RelatedItemsManager.tsx
│   └── upload/
│       └── FileUploader.tsx
└── lib/
    ├── auth.ts                   # NextAuth 設定
    ├── prisma.ts                 # Prisma Client
    ├── item-utils.ts             # 自動編號
    └── tree-utils.ts             # 樹狀結構
```
