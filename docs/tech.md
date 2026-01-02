# 技術文件 - 專案項目資訊管理系統 (tech.md)

>> 最後更新: 2026-01-02

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
- **自定義表格**: 實作 `TableSizeDialog` 元件，允許使用者在插入表格前設定行數與列數 (1-20)。
- **Link 優化**: 實作 `LinkDialog` 元件，支援同時輸入顯示文字與 URL，改善原本需先選取文字的流程。
- **導覽選單優化**:
  - **摺疊功能**: `ItemTree` 支援 `isExpanded` 狀態，點擊箭頭圖示可切換展開/折疊。
  - **當前項目高亮**: 透過 `currentItemId` Prop 識別目前頁面項目，並套用 `var(--color-primary-soft)` 背景與側邊邊框。

### 4.5 Approval Dashboard 優化

**功能增強**:

- **UPDATE 請求詳情**: 顯示項目編號 (`item.fullId`)、當前標題、提交人名稱
- **自我審核防呆**: 非 ADMIN 角色無法審核自己提交的申請
- **Dashboard UI 重新設計**:
  - Grid 卡片式佈局 (responsive, `minmax(320px, 1fr)`)
  - 每張卡片顯示摘要資訊（類型、標題、專案、提交人、日期）
  - 點擊展開顯示完整詳情面板
  - 視覺回饋（邊框高亮、陰影、縮放效果）
  - Approve/Reject 按鈕僅在展開狀態顯示

**實作細節**:

```typescript
// Self-approval prevention in approveRequest()
if (session.user.role !== "ADMIN" && request.submittedById === session.user.id) {
    throw new Error("You cannot approve your own change request");
}
```

### 4.6 Project Management 機制

**核心功能**:

- **Project Edit Flow**:
  - 使用 `submitUpdateProjectRequest` Server Action
  - 產生 `PROJECT_UPDATE` 類型 ChangeRequest
  - 針對 `Project` 模型進行更新 (Title, Description)
  - 權限: EDITOR, INSPECTOR, ADMIN
- **Project Delete Flow**:
  - 使用 `submitDeleteProjectRequest` Server Action
  - 產生 `PROJECT_DELETE` 類型 ChangeRequest
  - 權限: ADMIN Only
  - **安全檢查**: 提交與執行時皆檢查 `project._count.items > 0`，防止刪除非空專案

**資料庫 Schema**:

原有 `ChangeRequest` 模型即可支援，僅需擴充 `type` 列舉值與邏輯處理：

```prisma
model ChangeRequest {
  type String // 新增: "PROJECT_UPDATE", "PROJECT_DELETE"
  // ...
  targetProjectId Int? // 用於指定目標專案
}
```

---

### 4.7 Item History & Global Dashboard

**核心功能**:

- **Item History**: 記錄所有變更 (CREATE, UPDATE, DELETE)
- **Snapshot Strategy**: 每次變更儲存完整快照 (Snapshot)，便於獨立還原
- **Data Redundancy**: 針對已刪除項目，儲存 `itemFullId`, `itemTitle`, `projectId` 等欄位，確保項目被硬刪除後仍可查詢歷史

**Database Schema**:

```prisma
model ItemHistory {
  id              Int      @id @default(autoincrement())
  itemId          Int?     // 可為 null (當 Item 被硬刪除時)
  version         Int
  changeType      String   // CREATE, UPDATE, DELETE
  snapshot        String   // JSON string of full item state
  diff            String?  // JSON string of changes
  
  // Redundant fields for deleted items
  itemFullId      String?
  itemTitle       String?
  projectId       Int?
}
```

**Global Dashboard UI**:

- **三層式結構**: Project List -> Project Tree -> History List
- **Progressive Disclosure**: 逐步揭露資訊，避免一次載入過多資料
- **Diff Rendering**: 後端計算差異，前端渲染 Rich Text 內容 (支援 HTML Diff)
- **權限**: 開放給所有登入使用者瀏覽，確保資訊透明

**前端實現**:

- **HistorySidebar**: 顯示專案內所有項目 (包含已刪除)，支援搜尋
- **Rich Text Diff**: 針對 `content` 欄位，使用 `dangerouslySetInnerHTML` 渲染 HTML 差異，並還原 `ATTACHMENTS` 連結

### 4.8 專案搜尋功能

**核心功能**:

- **全文搜尋**: 在指定專案內搜尋 Title 與 Content
- **HTML/JSON 過濾**: 避免搜尋結果包含 HTML 標籤或 JSON 語法的匹配
- **關鍵字高亮**: 搜尋結果中高亮顯示匹配的關鍵字

**技術實作**:

檔案: `src/actions/search.ts`, `src/lib/search-utils.ts`

```typescript
// 1. 資料庫查詢 (模糊搜尋)
const items = await prisma.item.findMany({
  where: {
    projectId,
    OR: [
      { title: { contains: query } },
      { content: { contains: query } }
    ]
  }
});

// 2. 過濾 HTML 標籤內容
const filteredItems = items.filter(item => {
  const plainContent = stripHtmlTags(item.content);
  const searchableText = `${item.title}\n\n${plainContent}`;
  return searchableText.toLowerCase().includes(query.toLowerCase());
});

// 3. 生成搜尋片段與高亮
function generateSnippets(text: string, query: string) {
  // 找出匹配位置，擷取前後文本
  // 使用 <mark> 標籤高亮顯示
}
```

**前端頁面**: `/projects/[id]/search?q=keyword`

- 使用 `SearchResults` 元件顯示結果
- 卡片式佈局，可點擊跳轉至項目詳情頁

### 4.9 UI 對話框優化與自我審核防止

**問題記錄**:

| 問題 | 原因 | 解決方案 |
|------|------|----------|
| 刪除對話框閃現 | `window.confirm()` 與 React 狀態衝突 | 改用 React 自訂對話框 + state 管理 |
| Approval 對話框閃現 | `alert()` 阻塞式對話框 | 改用 React 自訂 errorDialog 元件 |

**統一 Dialog 設計**:

所有對話框統一採用 glass modal 設計：

```typescript
const dialogStyle = {
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  backdropFilter: 'blur(8px)',
  // ...
};

const contentStyle = {
  className: "glass",
  backgroundColor: 'var(--color-bg-surface)',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  border: '1px solid var(--color-border)',
  // ...
};
```

**自我審核防止機制**:

檔案: `src/components/approval/ApprovalList.tsx`, `src/app/admin/approval/page.tsx`

```typescript
// 1. 視覺標注
{req.submittedBy.username === currentUsername && (
  <div style={{ 
    backgroundColor: "var(--color-warning-soft)",
    color: "var(--color-warning)"
  }}>
    ⚠️ 您提交的申請
  </div>
)}

// 2. 邊框與背景警示
border: req.submittedBy.username === currentUsername
  ? "2px solid var(--color-warning)"
  : "2px solid transparent",
backgroundColor: req.submittedBy.username === currentUsername
  ? "rgba(234, 179, 8, 0.05)"
  : undefined

// 3. 操作攔截
const handleApproveClick = (e, id) => {
  const request = requests.find(r => r.id === id);
  if (request && request.submittedBy.username === currentUsername) {
    setErrorDialog('您不能批准自己提交的申請。請由其他審核人員處理。');
    return;
  }
  setConfirmDialog({ id, action: 'approve' });
};
```

**錯誤對話框**:

- 標題: 「權限受限」(紅色)
- 內容: 友善的錯誤訊息
- 只有「確定」按鈕關閉

```

---

## Phase 5: 檔案管理系統 (v0.8.0)

### 5.1 Database Schema

**新增模型**:

```prisma
model DataFile {
  id          Int      @id @default(autoincrement())
  
  // Metadata
  dataYear    Int                    // 資料年份
  dataName    String                 // 資料名稱
  dataCode    String   @unique       // 資料編碼 (唯一)
  author      String                 // 作者
  description String                 // 內容簡介
  
  // File Info
  fileName    String                 // 原始檔名
  filePath    String                 // 儲存路徑
  fileSize    Int                    // 檔案大小 (bytes)
  mimeType    String                 // MIME 類型
  
  // Status
  isDeleted   Boolean  @default(false)
  currentVersion Int   @default(1)
  
  // Relations
  changeRequests DataFileChangeRequest[]
  history        DataFileHistory[]
  
  @@index([dataYear])
  @@index([dataCode])
}

model DataFileChangeRequest {
  id          Int      @id @default(autoincrement())
  type        String   // FILE_CREATE, FILE_UPDATE, FILE_DELETE
  status      String   @default("PENDING")
  data        String   // JSON content
  
  fileId      Int?
  file        DataFile? @relation(fields: [fileId], references: [id])
  
  submittedById String
  submittedBy   User   @relation("FileSubmittedBy", fields: [submittedById], references: [id])
  
  reviewedById  String?
  reviewedBy    User?  @relation("FileReviewedBy", fields: [reviewedById], references: [id])
  
  reviewNote    String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model DataFileHistory {
  id          Int      @id @default(autoincrement())
  
  fileId      Int?
  file        DataFile? @relation(fields: [fileId], references: [id], onDelete: SetNull)
  
  version     Int
  changeType  String   // CREATE, UPDATE, DELETE
  snapshot    String   // JSON
  diff        String?  // JSON
  
  submittedById String
  submittedBy   User   @relation("FileHistorySubmitter", fields: [submittedById], references: [id])
  
  reviewedById  String?
  reviewedBy    User?  @relation("FileHistoryReviewer", fields: [reviewedById], references: [id])
  
  reviewStatus  String
  reviewNote    String?
  
  // Redundant fields for deleted files
  dataCode      String
  dataName      String
  dataYear      Int
  
  createdAt     DateTime @default(now())
  
  @@index([fileId, version])
  @@index([fileId, createdAt])
  @@index([dataYear])
}
```

### 5.2 File Upload API

**Endpoint**: `POST /api/datafiles/upload`

**Features**:

- 100MB 檔案大小限制
- 年份目錄結構: `/public/uploads/datafiles/{year}/`
- 唯一檔名生成: `{dataCode}_{timestamp}_{originalName}`
- 驗證與權限檢查 (EDITOR+)

**Implementation**:

```typescript
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === 'VIEWER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const dataCode = formData.get('dataCode') as string;
  const dataYear = formData.get('dataYear') as string;

  // Create year directory
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'datafiles', dataYear);
  await fs.mkdir(uploadDir, { recursive: true });

  // Generate unique filename
  const timestamp = Date.now();
  const ext = path.extname(file.name);
  const uniqueFilename = `${dataCode}_${timestamp}${ext}`;
  const filePath = path.join(uploadDir, uniqueFilename);

  // Save file
  const bytes = await file.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(bytes));

  return NextResponse.json({
    filePath: `/uploads/datafiles/${dataYear}/${uniqueFilename}`,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type
  });
}
```

### 5.3 Server Actions

**Query Actions** (`src/actions/data-files.ts`):

- `getDataFiles(year?)`: 取得檔案列表，包含待審核狀態
- `getDataFile(id)`: 取得單一檔案詳情
- `searchDataFiles(query, year?)`: 搜尋檔案
- `getDataFileYears()`: 取得可用年份列表

**Request Actions**:

- `submitCreateDataFileRequest(data)`: 提交新增申請
- `submitUpdateDataFileRequest(fileId, data)`: 提交編輯申請
- `submitDeleteDataFileRequest(fileId)`: 提交刪除申請

**Approval Actions**:

- `getPendingDataFileRequests()`: 取得待審核申請
- `approveDataFileRequest(requestId)`: 批准申請
- `rejectDataFileRequest(requestId, note?)`: 拒絕申請

**Key Logic**:

```typescript
// Include pending request status
export async function getDataFiles(year?: number) {
  const files = await prisma.dataFile.findMany({
    where: { isDeleted: false, ...(year ? { dataYear: year } : {}) },
    include: {
      changeRequests: {
        where: { status: 'PENDING' },
        select: { id: true, type: true }
      }
    }
  });

  return files.map(file => ({
    ...file,
    hasPendingRequest: file.changeRequests.length > 0,
    pendingRequestType: file.changeRequests[0]?.type || null
  }));
}
```

### 5.4 Frontend Components

**DataFileList** (`src/components/datafile/DataFileList.tsx`):

- **雙視圖模式**: 卡片 (grid) / 清單 (table)
- **排序功能**: 6 個欄位 (名稱、編碼、年份、作者、大小、時間)
- **狀態標籤**: 顯示「⏳ 審核中」badge

**DataFileApprovalList** (`src/components/datafile/DataFileApprovalList.tsx`):

- **前後比較**: 類似 Item 審核的 diff 顯示
- **修改欄位提示**: 顯示「⚡ 修改欄位：名稱、作者...」
- **ADMIN 例外**: ADMIN 可審核自己的申請

**CompareField Helper**:

```typescript
function CompareField({ label, current, proposed, isUpdate, mono, multiline }) {
  const hasChange = isUpdate && current !== proposed && proposed !== undefined;
  
  return (
    <div>
      <strong>{label} {hasChange && <span>• 已修改</span>}</strong>
      <div style={{ display: 'flex', gap: '1rem' }}>
        {isUpdate && <div>修改前: {current}</div>}
        <div style={{ 
          backgroundColor: hasChange ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0,0,0,0.03)',
          border: hasChange ? '1px solid var(--color-success)' : '1px solid var(--color-border)'
        }}>
          修改後: {proposed}
        </div>
      </div>
    </div>
  );
}
```

### 5.5 權限設計

| 角色 | 上傳 | 編輯申請 | 刪除申請 | 審核 |
|------|:----:|:--------:|:--------:|:----:|
| VIEWER | ❌ | ❌ | ❌ | ❌ |
| EDITOR | ✅ | ✅ | ✅ | ❌ |
| INSPECTOR | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ (含自審) |

**特殊規則**:

- EDITOR/INSPECTOR 可提交刪除申請（需審核）
- ADMIN 可審核自己提交的檔案申請（例外處理）

---

## 問題解決記錄

### 常見問題速查

| 問題 | 解決方案 |
|------|----------|
| Tiptap SSR Hydration Error | `immediatelyRender: false` |
| 日期格式不一致 | 使用固定 locale |
| Prisma 類型未更新 | `npx prisma generate` + 重啟 |
| confirm() 對話框閃現 | 改用 React 自訂對話框 |
| alert() 對話框閃現 | 改用 React errorDialog state |
| Server Component Prisma 錯誤 | 移除 `"use client"` |
| 搜尋結果包含 HTML 標籤 | 過濾 HTML 後再比對 |

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
