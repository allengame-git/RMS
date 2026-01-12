# 技術文件 - 專案項目資訊管理系統 (tech.md)

>> 最後更新: 2026-01-09

## 專案資訊

| 項目 | 說明 |
| :--- | :--- |
| **專案名稱** | 專案項目資訊管理系統 (RMS) |
| **技術棧** | Next.js 14, TypeScript, Prisma, SQLite, NextAuth.js |
| **樣式方案** | Vanilla CSS + CSS Variables |
| **編輯器** | Tiptap (ProseMirror-based) |
| **部署方案** | Docker + Nginx (HTTPS) |

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
| :--- | :--- |
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

```text
根項目: PROJECT-1, PROJECT-2, ...
子項目: PARENT-1, PARENT-2, ...
範例:  WQ-1 → WQ-1-1 → WQ-1-1-1
```

### 審核流程 (Change Request)

| 狀態 | 說明 |
| :--- | :--- |
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
| :--- | :--- |
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
| :--- | :---: | :---: | :---: | :---: |
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
| :--- | :--- | :--- |
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
| :--- | :--- | :--- |
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
- 唯一檔名生成: `{dataCode}__{timestamp}__{originalName}` (若無 dataCode 則自動生成)
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
  const dataCode = formData.get('dataCode') as string | null;  // Optional
  const dataYear = formData.get('dataYear') as string;

  // Create year directory
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'datafiles', dataYear);
  await fs.mkdir(uploadDir, { recursive: true });

  // Generate unique filename
  const timestamp = Date.now();
  const ext = path.extname(file.name);
  const safePrefix = dataCode?.trim() 
    ? dataCode.replace(/[^a-zA-Z0-9-_]/g, '_') 
    : `file_${timestamp.toString(36)}`;
  const uniqueFilename = `${safePrefix}_${timestamp}${ext}`;
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
| :--- | :---: | :---: | :---: | :---: |
| VIEWER | ❌ | ❌ | ❌ | ❌ |
| EDITOR | ✅ | ✅ | ✅ | ❌ |
| INSPECTOR | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ (含自審) |

**特殊規則**:

- EDITOR/INSPECTOR 可提交刪除申請（需審核）
- ADMIN 可審核自己提交的檔案申請（例外處理）

---

## Phase 7: 品質文件數位簽章 (v1.0.0)

### 7.1 使用者資格系統

**資料庫擴充**:

```prisma
model User {
  // ... existing fields
  isQC          Boolean  @default(false)  // QC 審核資格
  isPM          Boolean  @default(false)  // PM 核定資格
  signaturePath String?                   // 數位簽名圖片路徑
}
```

**管理功能**:

- `/admin/users` 頁面可設定使用者的 QC/PM 資格
- 支援上傳數位簽名圖片 (PNG/JPG)
- 只有具備對應資格的使用者才能審核品質文件

### 7.2 QCDocumentApproval 模型

**資料庫結構**:

```prisma
model QCDocumentApproval {
  id              Int      @id @default(autoincrement())
  
  itemHistoryId   Int      @unique
  itemHistory     ItemHistory @relation(fields: [itemHistoryId], references: [id])
  
  status          String   @default("PENDING_QC")
  
  qcApprovedById  String?
  qcApprovedBy    User?    @relation("QCApprover", fields: [qcApprovedById], references: [id])
  qcApprovedAt    DateTime?
  qcNote          String?
  
  pmApprovedById  String?
  pmApprovedBy    User?    @relation("PMApprover", fields: [pmApprovedById], references: [id])
  pmApprovedAt    DateTime?
  pmNote          String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**狀態流程**:

| 狀態 | 說明 |
| :--- | :--- |
| `PENDING_QC` | 待 QC 審核 |
| `PENDING_PM` | QC 已審核，待 PM 核定 |
| `COMPLETED` | PM 已核定，流程完成 |
| `REJECTED` | QC 或 PM 駁回 |

### 7.3 後端審核 Actions

**檔案**: `src/actions/qc-approval.ts`

| 函數 | 說明 |
| :--- | :--- |
| `getQCDocumentApprovals()` | 根據使用者資格取得待審核文件 |
| `approveAsQC(id, note?)` | QC 審核通過，嵌入簽名，轉為 PENDING_PM |
| `approveAsPM(id, note?)` | PM 核定通過，嵌入簽名，轉為 COMPLETED |
| `rejectQCDocument(id, note)` | 駁回文件 |

**簽名嵌入流程**:

```typescript
// 審核通過後自動嵌入簽名
const user = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { signaturePath: true }
});

if (user?.signaturePath) {
  await embedSignatureInPDF(
    approval.itemHistory.isoDocPath,
    user.signaturePath,
    "qc", // 或 "pm"
    session.user.username
  );
}
```

### 7.4 PDF 生成技術優化

**問題與解決**:

| 問題 | 原因 | 解決方案 |
| :--- | :--- | :--- |
| pdfkit 在 Next.js 中失敗 | pdfkit 嘗試載入 Helvetica.afm 字型檔 | 改用 `pdf-lib` 取代 pdfkit |
| 中文顯示問題 | 預設字型不支援中文 | 使用 `@pdf-lib/fontkit` 嵌入 Arial Unicode 字型 |
| 富文本格式遺失 | 純文字無法保留 HTML 格式 | 使用 Puppeteer 截圖渲染內容 |

**PDF 生成核心套件**:

- `pdf-lib`: 純 JavaScript PDF 生成/修改函式庫
- `@pdf-lib/fontkit`: 字型嵌入支援
- `puppeteer`: HTML 截圖渲染

**檔案結構**:

```text
src/lib/
├── pdf-generator.ts      # PDF 生成 (pdf-lib)
├── pdf-signature.ts      # 簽名嵌入
└── html-renderer.ts      # HTML 截圖 (Puppeteer)
```

**HTML 截圖流程**:

```typescript
import puppeteer from 'puppeteer';

export async function renderHtmlToImage(htmlContent: string, width: number): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setViewport({ width, height: 800, deviceScaleFactor: 2 });
    await page.setContent(wrapWithStyles(htmlContent));
    
    const screenshot = await page.screenshot({ type: 'png' });
    await browser.close();
    
    return screenshot;
}
```

### 7.5 前端整合

**審核頁面擴充** (`/admin/approval`):

- 新增「品質文件審核」區塊
- 只對 `isQC` 或 `isPM` 使用者顯示
- 根據使用者資格顯示對應階段的待審核文件

**元件結構**:

```text
src/
├── app/admin/approval/
│   ├── page.tsx                      # 主頁面
│   └── QCDocumentApprovalSection.tsx # QC 審核區塊 (Client)
└── components/approval/
    └── QCDocumentApprovalList.tsx    # 審核清單元件
```

---

### 6.1 架構與流程

**核心概念**:

- **觸發時機**: 項目變更申請 (Create/Update/Delete) 被核准 (APPROVED) 時
- **生成方式**: 後端非同步生成 PDF，不阻塞主要流程 (但需確保生成成功後更新 DB)
- **儲存策略**: 產生靜態檔案至 `/public/iso_doc/`，資料庫儲存相對路徑

### 13. S.O.P. & Structure

1. **Wait for Approval**: 監聽 DB 變更或 Polling 與 Action 回傳 (目前採用 Action 回傳即時生成)
2. **Retrieve Data**: 獲取完整 Item History, Project Info, User Info
3. **Render PDF**:
   - 表頭: 專案資訊, 文件編號 QC-[Project]-[ID]
   - 內容: Item Title, Content (Snapshot), Attachments List
   - 簽核欄: 提交者 (System Stamp), 核准者 (System Stamp), QC (Pending), PM (Pending)
   - 浮水印: "CONFIDENTIAL"
4. **Save**: 寫入 `/public/iso_doc/`
5. **Update DB**: 建立 `QCDocumentApproval` 紀錄關聯

### 狀態: ✅ 已完成

---

## Phase 13: 系統全面中文化與 UI 現代化 (v1.5.0)

### 13.1 Localization Strategy

**手動中文化 (No i18n Library)**:
為保持專案架構簡單，不使用 `next-i18next` 或 `react-intl`，直接將 UI 文字替換為繁體中文。

**範圍**:

- **Pages**: 所有 Route 頁面 (Projects, Items, Admin, Login)
- **Components**: 共用元件 (Modal, Button, Dialog)
- **Server Actions**: 錯誤訊息與成功提示 (Toasts)
- **Database Data**: 部分預設資料已中文化，使用者輸入內容維持原樣

### 13.2 Bento Grid UI Architecture

**設計哲學**:
採用 "Bento Grid" (便當盒/網格) 佈局，強調內容區塊化與資訊層級。

**技術實作**:

- **CSS Grid**: 使用 `grid-template-columns: repeat(auto-fit, minmax(...))` 實現響應式佈局
- **Glassmorphism**: 使用 `backdrop-filter: blur()` 與半透明背景
- **Image Optimization**: 使用 Next.js `<Image>` 元件優化載入效能
- **Visual Assets**: 整合工業風黑白攝影圖片 (`/public/bento_*.jpg`)

**Layout Structure**:

1. **Welcome Card (Large)**: 個人化歡迎訊息與時間
2. **System Overview (Wide)**: 4 個關鍵數據指標 (Projects, Items, Files, Pending)
3. **Quick Actions (Small)**: 常用功能捷徑
4. **Pending Tasks (Vertical)**: 待辦事項清單
5. **Recent Activity (Medium)**: 最近系統活動

---

## Phase 14: 變更申請取消流程 (v1.6.0)

### 14.1 Cancel Request Mechanism

**核心需求**:
允許使用者「撤回」或「取消」已被退回 (REJECTED) 的申請，避免無效資料堆積。

**Server Action**: `cancelRejectedRequest(requestId)`

**邏輯**:

1. 驗證權限: `submittedBy === currentUser` OR `role === ADMIN`
2. 驗證狀態: `request.status === 'REJECTED'`
3. **硬刪除**: 直接執行 `prisma.changeRequest.delete()`，完全移除該筆申請紀錄 (因為尚未影響 Item 資料)

**UI Interaction**:

- **Location**: `/admin/rejected-requests`
- **Component**: `CancelRequestButton` (Client Component)
- **Confirmation**: `window.confirm` 二次確認

2. DB 更新 ChangeRequest 狀態為 APPROVED
2. `createHistoryRecord` 建立 ItemHistory
3. `generateQCDocument` 觸發 PDF 生成
4. 更新 ItemHistory 的 `isoDocPath`

---

## Phase 12: ISO 文件頁面優化 (v1.4.0)

### 12.1 頁面重構與分組

- **功能**: `/iso-docs` 頁面改版，依專案 (Project) 分組顯示品質文件。
- **UI**: 卡片式專案列表，顯示文件數量與最後更新時間。
- **路由**: 新增 `/iso-docs/[projectId]` 子頁面，顯示特定專案的所有文件。

### 12.2 ISO 文件搜尋

**搜尋邏輯**:

- **範圍**: 全域搜尋 (所有專案與文件)
- **關鍵字匹配**:
  - Item Full ID (e.g., `PJ-1-01`)
  - Item Title
  - Project Title
  - Project Code Prefix
- **實作**: URL Search Params (`?q=keyword`) + Server Action (`getRecentIsoDocUpdates`, `getIsoDocsGroupedByProject`)

**前端元件**:

- `IsoDocSearch.tsx`: Client Component，處理輸入與 URL 更新 (Debounce)。

### 12.3 資料存取優化

**Action 修改**:

- `getIsoDocsGroupedByProject(query)`: 支援 OR 查詢 (Project props OR ItemHistory props)
- `getRecentIsoDocUpdates(limit, query)`: 支援關聯查詢與過濾
- **Revision Count**: 在 `qcApproval` 關聯中包含 `revisionCount` 欄位，正確顯示修訂次數。

### 12.4 下載功能

- **直接下載**: 在「最近更新紀錄」表格中新增下載欄位。
- **按鈕**: 檢查 `isoDocPath` 是否存在，顯示「📄 下載」按鈕 (新分頁開啟)。

---

## Phase 13: 認證系統強化

### 13.1 登入審計日誌

**資料庫模型**:

```prisma
model LoginLog {
  id         Int      @id @default(autoincrement())
  userId     String?
  username   String
  success    Boolean
  ipAddress  String?
  userAgent  String?
  failReason String?
  createdAt  DateTime @default(now())
  
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([userId])
  @@index([username])
  @@index([createdAt])
  @@index([success])
}
```

**Server Actions** (`src/actions/audit.ts`):

| 函數 | 說明 |
| :--- | :--- |
| `logLoginAttempt()` | 記錄登入嘗試 (成功/失敗) |
| `getLoginLogs()` | 查詢登入日誌 (支援篩選) |
| `getLoginStats()` | 取得 7 天統計資訊 |

**前端頁面** (`/admin/audit`):

- 統計卡片：總登入次數、成功/失敗數、成功率
- 登入紀錄表格：時間、使用者、狀態、IP、瀏覽器、備註

### 13.2 密碼複雜度策略

**配置** (`src/lib/password-policy.ts`):

```typescript
export const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,
};
```

**驗證函數**:

| 函數 | 說明 |
| :--- | :--- |
| `validatePassword()` | 驗證密碼並回傳錯誤訊息列表 |
| `getPasswordRequirements()` | 取得規則清單 (供 UI 顯示) |

**前端元件** (`PasswordStrengthIndicator.tsx`):

- 密碼強度進度條 (顏色隨強度變化)
- 各項規則符合狀態清單 (✓/○)
- 強度標籤：強/中/弱/非常弱

### 13.3 帳號鎖定機制

**User 模型擴充**:

```prisma
model User {
  // ... existing fields
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
}
```

**鎖定規則**:

| 規則 | 值 |
| :--- | :--- |
| 最大失敗次數 | 5 次 |
| 鎖定時間 | 15 分鐘 |
| 計數重置 | 成功登入後 |

**驗證流程** (`src/lib/auth.ts`):

```typescript
// 1. 檢查帳號是否鎖定
if (user.lockedUntil && user.lockedUntil > new Date()) {
  throw new Error(`帳號已鎖定，請於 ${remainingMinutes} 分鐘後再試`);
}

// 2. 密碼驗證失敗
if (!isPasswordValid) {
  const newAttempts = user.failedLoginAttempts + 1;
  if (newAttempts >= 5) {
    // 鎖定帳號 15 分鐘
    await prisma.user.update({
      data: { failedLoginAttempts: newAttempts, lockedUntil: new Date(Date.now() + 15 * 60000) }
    });
  }
}

// 3. 登入成功 → 重置計數
if (user.failedLoginAttempts > 0) {
  await prisma.user.update({ data: { failedLoginAttempts: 0, lockedUntil: null } });
}
```

**Admin 解鎖功能** (`src/actions/users.ts`):

- `unlockUser(userId)`: Admin 可手動解鎖帳號
- `getUsersWithLockStatus()`: 取得使用者列表含鎖定狀態

**前端顯示** (`/admin/users`):

- 狀態欄位：正常 (✓) / 已鎖定 (🔒) / 失敗 N 次 (⚠️)
- 解鎖按鈕 (鎖定使用者才顯示)
- 鎖定帳號列紅色高亮
