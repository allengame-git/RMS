# 功能實作計畫 (implementation_plan.md)

> 最後更新: 2026-01-20

本文件記錄各功能的需求分析與技術設計。

## 最新更新

- **Phase 25**: 單一專案備份與轉移功能 ✅ 已完成 (2026-01-20)
- **Phase 24**: 刪除流程優化與通知中心 UI 更新 ✅ 已完成 (2026-01-19)
- **Phase 23**: 專案頁面中文化與 UI 優化 ✅ 已完成 (2026-01-15)
- **Phase 22**: PDF 截斷修復 (支援多頁分頁) ✅ 已完成 (2026-01-14)
- **Phase 21**: 品質文件 PDF 歷史快照強化 ✅ 已完成 (2026-01-14)
- **Phase 20**: 品質文件 PDF 歷史快照功能恢復 ✅ 已完成 (2026-01-14)
- **Phase 19**: 富文本編輯器強化 (巢狀編號、縮排) ✅ 已完成 (2026-01-14)
- **Phase 18**: PDF-lib 重構與 Vercel 部署 ✅ 已完成 (2026-01-14)
- **Phase 17**: 專案複製功能 ✅ 已完成 (2026-01-13)
- **Phase 16**: QC/PM 複審流程 ✅ 已完成 (2026-01-13)

---

## 目錄

1. [標籤連結功能](#1-標籤連結功能-item-link)
2. [關聯項目功能](#2-關聯項目功能-related-items)
3. [階層式項目結構](#3-階層式項目結構-hierarchical-items)
4. [使用者權限管理](#4-使用者權限管理-user-management)
5. [項目編輯刪除流程](#5-項目編輯刪除流程-item-editdelete)
6. [Rich Text Editor 圖片功能](#6-rich-text-editor-圖片功能)
7. [Approval Dashboard 優化](#7-approval-dashboard-優化)
8. [富文本編輯器強化 (Phase 19)](#8-富文本編輯器強化-phase-19)
9. [品質文件 PDF 歷史快照功能恢復 (Phase 20)](#9-品質文件-pdf-歷史快照功能恢復-phase-20)
10. [品質文件 PDF 歷史快照強化 (Phase 21)](#10-品質文件-pdf-歷史快照強化-phase-21)
11. [PDF 截斷修復 (Phase 22)](#11-pdf-截斷修復-phase-22)

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
| 自定義表格 | `TableSizeDialog` 元件實作 (支援 1x1 ~ 20x20) |
| Link 優化 | `LinkDialog` 元件實作 (支援同時輸入文字與 URL) |
| 選單摺疊 | `ItemTree` 狀態管理 (展開/折疊) |
| 選單高亮 | `currentItemId` PropTypes 與樣式套用 |

### 問題解決

| 問題 | 解決方案 |
|------|----------|
| window.prompt() 閃退 | 改用 React InputDialog |
| Modal 被遮擋 | createPortal 至 body |
| 背景透明 | 使用正確 CSS 變數 |

### 狀態: ✅ 已完成 (含表格、Link 與導覽選單優化)

---

## 7. Approval Dashboard 優化

### 需求

改善審核流程的使用者體驗與資訊完整性。

### 功能增強

| 功能 | 說明 |
|------|------|
| UPDATE 請求詳情 | 顯示項目編號、當前標題、提交人 |
| 自我審核防呆 | 非 ADMIN 無法審核自己的申請 |
| Dashboard UI | Grid 卡片式佈局、點擊展開詳情 |

### 技術實作

**自我審核防呆**:

```typescript
// In approveRequest()
if (session.user.role !== "ADMIN" && request.submittedById === session.user.id) {
    throw new Error("You cannot approve your own change request");
}
```

**Dashboard UI 設計**:

- Grid 響應式佈局 (`minmax(320px, 1fr)`)
- 卡片顯示摘要資訊（類型、標題、專案、提交人、日期）
- 點擊展開/收合功能
- 展開時顯示完整詳情面板
- 視覺回饋（邊框、陰影、縮放）
- Approve/Reject 按鈕僅在展開狀態顯示

### 狀態: ✅ 已完成

---

## 8. 專案管理機制優化

> Status: ✅ Done (v0.6.0)

### 需求分析

- 專案資料需要經過審核流程才能修改或刪除 (Project Governance)
- 權限控管需求：
  - 編輯：EDITOR, INSPECTOR, ADMIN
  - 刪除：ADMIN Only
- 安全防護：
  - 已有 Items 的專案不可刪除
  - 刪除需二次確認

### 技術實作

**New ChangeRequest Types**:

- `PROJECT_UPDATE`: 用於修改專案標題與描述
- `PROJECT_DELETE`: 用於刪除專案

**Approval Flow**:

1. User 點擊 Edit/Delete 按鈕 (前端權限檢查)
2. 填寫表單/確認對話框
3. 呼叫 Server Action (`submitUpdateProjectRequest` / `submitDeleteProjectRequest`)
4. 建立 ChangeRequest (Status: PENDING)
5. Admin/Inspector 在 Approval Dashboard 審核
6. 審核通過 -> 更新/刪除 `Project` 資料

### 狀態: ✅ 已完成

---

## 9. Item History & Global Dashboard

> Status: ✅ Done (v0.7.0)

### 需求分析

- 記錄 Item 的完整變更歷史 (Versions)
- 支援還原或查看變更前狀態 (Diff)
- 管理員可查看全域變更歷史，包含已刪除的 Item

### 技術實作

**Schema**:

- `ItemHistory`: 儲存 `snapshot` (完整 JSON) 與 `diff` (變更差異)
- Redundant Data: `itemFullId`, `itemTitle` 儲存於 History 以支援刪除後查詢

**API**:

- `createHistoryRecord`: 在 `approveRequest` 時觸發
- `getItemHistory`: 查詢單一項目歷史
- `getGlobalHistory`: 查詢全域歷史 (分頁/搜尋)

**UI**:

- Item Detail 頁面底部顯示近期變更
- 獨立 History Detail 頁面顯示 Snapshot 與 Diff
- Global Dashboard 採用三層式導覽 (Project -> Tree -> List)

---

## 10. Phase 6: 部署準備與優化

> Status: ✅ Done (v0.9.0)

### 10.1 Approval Dashboard 中文化

- 項目變更申請卡片中文化
- 檔案變更申請卡片中文化
- 確認對話框中文化
- 移除 Root Item / Child Item 標籤

### 10.2 審核權限調整

**變更規則**:

- 使用者可以「拒絕」自己的申請 (撤回功能)
- 使用者不能「批准」自己的申請 (ADMIN 例外)

**實作**:

```typescript
// handleReject 移除自我拒絕限制
const handleReject = async (id: number) => {
    // 允許使用者拒絕自己的申請
    setConfirmDialog({ id, action: 'reject' });
};
```

### 10.3 內容比較優化

- 項目變更申請「內容」欄位修改前後比較
- 使用 flex 並排顯示 (修改前 | 修改後)

### 10.4 全域歷史 Dashboard 優化

- 頁面中文化 (專案/項目/檔案)
- 新增「最近更新紀錄」區塊 (最新100筆)
- 支援篩選功能 (全部/項目/檔案)
- 相對時間顯示 (N分鐘前)

**元件**:

- `RecentUpdatesTable.tsx`: 可篩選的更新紀錄表格 (Client Component)
- `getRecentUpdates()`: 合併 ItemHistory 和 DataFileHistory

### 10.5 Docker 部署準備

**建立檔案**:

| 檔案 | 用途 |
|------|------|
| `Dockerfile` | 多階段構建 Node.js 應用映像 |
| `docker-compose.yml` | 編排 App + Nginx 容器 |
| `nginx/nginx.conf` | HTTPS 反向代理配置 |
| `src/app/api/health/route.ts` | 健康檢查 API |
| `scripts/backup.ps1` | Windows 自動備份腳本 |
| `scripts/restore.ps1` | 災難復原腳本 |
| `scripts/verify.ps1` | 自動檢驗腳本 |

**文件**:

| 文件 | 說明 |
|------|------|
| `docs/deployment_guide.md` | 完整部署規劃 |
| `docs/deployment_steps.md` | Step-by-Step 部署指南 |
| `docs/deployment_checklist.md` | 檢驗清單 |

### 10.6 檔案上傳優化

- 拖放上傳功能 (Drag & Drop)
- 欄位必要性調整 (年份/名稱/作者/檔案必填，其他選填)
- 視覺回饋 (拖曳時邊框變色、背景變化)

**實作**:

```typescript
const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) setFile(droppedFile);
};
```

### 狀態: ✅ 已完成

---

## 11. Phase 8: UI/UX 優化與強化

> Status: ✅ Done (v1.1.0)

### 11.1 首頁儀表板 Infographic 改版

**目標**:

- 採用 Infographic 視覺風格
- 新增全域色彩變數 (Teal, Orange, Yellow, Navy)
- 三卡片佈局 (系統概覽、近期活動、待辦事項)

**檔案修改**:

- `src/app/globals.css`: 新增 CSS 變數
- `src/app/page.tsx`: 重新設計 Dashboard UI

### 11.2 側邊欄導覽強化

**目標**:

- `SidebarNav` 還原新增子項目功能
- `HistorySidebar` 改為 Accordion 效果

**檔案修改**:

- `src/components/item/SidebarNav.tsx`: 新增 `canEdit`, `projectId` props
- `src/components/history/HistorySidebar.tsx`: Accordion 樹狀結構
- `src/app/items/[id]/page.tsx`: 傳遞 props

### 11.3 歷史詳情審查紀錄優化

**目標**:

- 詳細顯示提交者、核准者、QC、PM 姓名與時間

**檔案修改**:

- `src/actions/history.ts`: `getHistoryDetail` 新增 `qcApproval` 關聯
- `src/app/admin/history/detail/[id]/page.tsx`: 審查紀錄詳情卡片

### 狀態: ✅ 已完成

---

## 12. Phase 9: 管理員自我編輯功能

> Status: ✅ Done (v1.1.0)

### 12.1 需求分析

- **目標**: 允許 ADMIN 在使用者管理介面修改自己的密碼
- **限制**: 為防止權限遺失，ADMIN 不可修改自己的角色 (Role)
- **現況**: 目前 UI 完全禁用 ADMIN 編輯自己的按鈕

### 12.2 實作計畫

**前端修改 (`src/app/admin/users/page.tsx`)**:

1. **啟用編輯按鈕**:
   - 移除 `Edit` 按鈕對 `session.user.id === user.id` 的禁用狀態
   - 保留 `Delete` 按鈕的禁用狀態 (防止自殺)

2. **編輯 Modal 防呆**:
   - 在 Role `<select>` 加入 `disabled={editingUser.id === session.user.id}`
   - 確保密碼欄位可正常使用
   - Qualifications (QC/PM) 欄位可維持開放或視需求鎖定 (目前建議保持開放)

### 12.3 驗證計畫

1. 以 Admin 登入
2. 點擊自己的 Edit 按鈕 (應可點擊)
3. 修改密碼 -> 登出 -> 使用新密碼登入 (應成功)
4. 修改密碼 -> 登出 -> 使用新密碼登入 (應成功)
5. 嘗試修改自己的 Role (應無法修改)

---

## 10. Phase 10: 品質文件 PDF 優化

> Status: ✅ Done (v1.2.0)

### 13.1 需求分析

- **PDF 結構優化**: 移除舊版文字預覽，改為標準化表單 (含詳細簽核資訊)
- **檔案管理**: 強制單一檔案策略 (`QC-[Project]-[ID].pdf`)
- **內容附件**: PM 核准後，自動截圖變更內容 (HTML Snapshot) 並附加於文件末尾

### 13.2 技術實作

**Screenshot Generation**:

- Library: `puppeteer` (Headless Chrome)
- Flow:
  1. `generateQCDocument` 收到的 `history` 包含 `snapshot`
  2. 解析 `snapshot.content` (HTML)
  3. 使用 Puppeteer `page.setContent(html)` 渲染
  4. `page.screenshot({ type: 'png' })`
  5. `pdf-lib` 嵌入圖片至新頁面

**注意事項**:

- 中文字型需確保 Puppeteer 環境可讀取
- 樣式需注入 (Tailwind or Basic CSS) 以確保可讀性

---

## 14. Phase 13: 系統全面中文化與 UI 現代化

> Status: ✅ Done (v1.5.0)

### 14.1 需求分析

- **全面中文化**: 將系統所有操作介面、提示訊息、錯誤訊息轉為繁體中文，提升台灣使用者體驗。
- **UI 現代化**: 改造首頁 Dashboard，採用更具視覺衝擊力的 Bento Grid 設計，結合工業風元素。

### 14.2 技術實作

**Localization**:

- 直接替換 Component 與 Page 中的 Hardcoded Strings
- 統一術語：Project -> 專案, Item -> 項目, Change Request -> 變更申請

**Bento Grid Layout**:

- Grid Container: `display: grid; grid-template-columns: repeat(4, 1fr);`
- Card Spanning: 利用 `col-span-2`, `row-span-2` 創造錯落感
- Visuals: 使用 `next/image` 載入高畫質黑白攝影圖片，搭配 `mix-blend-mode` 與 `backdrop-filter`

### 14.3 狀態: ✅ 已完成

---

## 15. Phase 14: 變更申請取消流程

> Status: ✅ Done (v1.6.0)

### 15.1 需求分析

- **痛點**: 使用者提交錯誤或被退回後，無法取消該筆申請，導致列表堆積。
- **解法**: 提供「取消申請」功能，允許使用者撤銷被退回的變更請求。

### 15.2 技術實作

**Permission Logic**:

- 下列情況允許取消:
  1. 申請狀態為 `REJECTED`
  2. 操作者是原提交人 (Submitter) 或 管理員 (Admin)

**Action**: `cancelRejectedRequest(requestId)`

- 驗證權限與狀態後，執行 `prisma.changeRequest.delete()`
- 使用 `revalidatePath` 更新 UI

**UI Component**: `CancelRequestButton`

- Client Component，處理 `window.confirm` 與 Loading 狀態

### 15.3 狀態: ✅ 已完成

---

## 16. Phase 15: 系統備份與復原

> Status: ✅ Done (v1.7.0)

### 16.1 需求分析

- **目標**: 提供完整的系統災害復原能力 (Disaster Recovery)
- **範圍**: 資料庫結構與資料、使用者上傳檔案、系統生成文件
- **操作**: 僅限系統管理員 (Admin) 操作

### 16.2 技術實作

**API Endpoints**:

- `GET /api/admin/backup/[type]`: 下載備份 (Stream Response)
- `POST /api/admin/restore/[type]`: 上傳並還原

**UI Components**:

- `BackupRestoreSection.tsx`: 整合備份與復原控制項
- **進度顯示**: 模擬進度條 (因為 Server Action 無法即時回傳進度)
- **狀態管理**: Loading, Success, Error 狀態切換

### 16.3 狀態: ✅ 已完成

---

## 17. Phase 16: QC/PM 複審流程

> Status: ✅ Done (v1.8.0)

### 17.1 需求分析

- **痛點**: 品質文件審核若有問題，只能全部駁回，無法要求部分修訂
- **解法**: 新增「要求修訂」狀態，允許 QC/PM 退回要求修改後重新提交

### 17.2 技術實作

**Schema 擴充**:

```prisma
model QCDocumentApproval {
  // ...existing fields
  revisionCount Int @default(0)  // 修訂次數
}
```

**狀態流程**:

| 狀態 | 說明 |
| :--- | :--- |
| `PENDING_QC` | 待 QC 審核 |
| `PENDING_PM` | 待 PM 核定 |
| `REVISION_REQUIRED` | 需要修訂 (被退回) |
| `COMPLETED` | 審核完成 |
| `REJECTED` | 永久駁回 |

**Server Actions**:

- `requestRevision(id, note)`: QC/PM 要求修訂
- 修訂完成後重新提交，狀態自動轉為 `PENDING_QC` 或 `PENDING_PM`
- 每次修訂 `revisionCount++`

### 17.3 狀態: ✅ 已完成

---

## 18. Phase 17: 專案複製功能

> Status: ✅ Done (v1.8.0)

### 18.1 需求分析

- **目標**: 快速建立相似結構的新專案
- **範圍**: 複製專案基本資料與項目結構
- **選項**: 可選擇是否包含項目內容與附件

### 18.2 技術實作

**Server Action**: `duplicateProject(projectId, newTitle, newPrefix)`

```typescript
// 核心邏輯
async function duplicateProject(projectId: number, title: string, prefix: string) {
  // 1. 建立新專案
  const newProject = await prisma.project.create({ data: { title, codePrefix: prefix } });
  
  // 2. 取得原專案所有項目
  const items = await prisma.item.findMany({ where: { projectId } });
  
  // 3. 遞迴複製項目 (維持父子關係)
  const idMap = new Map<number, number>();
  for (const item of items) {
    const newItem = await prisma.item.create({
      data: {
        projectId: newProject.id,
        parentId: item.parentId ? idMap.get(item.parentId) : null,
        fullId: generateFullId(prefix, item),
        title: item.title,
        content: item.content,
        // ...
      }
    });
    idMap.set(item.id, newItem.id);
  }
  
  return newProject;
}
```

### 18.3 狀態: ✅ 已完成

---

## 19. Phase 18: PDF-lib 重構與 Vercel 部署

> Status: ✅ Done (v1.8.0)

### 19.1 需求分析

- **問題**: Puppeteer 套件過大 (~200MB)，不適合 Serverless 環境
- **解法**: 移除 Puppeteer 依賴，改用 pdf-lib 純文字渲染

### 19.2 技術實作

**PDF 生成重構**:

```typescript
// 舊版: 使用 Puppeteer 截圖
// const screenshot = await renderHtmlToPDF(htmlContent);

// 新版: 使用 pdf-lib 純文字
async function generateHistorySummaryPages(pdfDoc: PDFDocument, history: ItemHistory) {
  const page = pdfDoc.addPage();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // 繪製歷史摘要 (項目編號、標題、變更類型等)
  page.drawText(`Item: ${history.itemFullId}`, { x: 50, y: 750, font });
  page.drawText(`Change Type: ${history.changeType}`, { x: 50, y: 730, font });
  // ...
}
```

**Vercel 部署調整**:

1. `force-dynamic` 加入所有動態 API 路由
2. 移除 fs 寫入操作 (Serverless 無持久化檔案系統)
3. 使用 Neon PostgreSQL 替代本地資料庫

---

## 8. 富文本編輯器強化 (Phase 19)

### 需求

- 支援有序列表的巢狀編號 (如 1.1, 1.2.1)。
- 支援段落與列表的增加/減少縮排。
- 支援文字對齊 (左、中、右)。
- 確保所有渲染富文本的頁面樣式一致。

### 技術方案

| 功能 | 實作方式 |
|------|----------|
| 巢狀編號 | CSS Counters (`counter-reset`, `counter-increment`, `counters()`) |
| 縮排功能 | 自定義 `Indent` Tiptap Extension，透過 `margin-left` inline style 儲存 |
| 快捷鍵 | 整合 `Tab` / `Shift+Tab` 觸發縮排/凸排 |
| 文字對齊 | 整合 `@tiptap/extension-text-align` |
| 樣式一致性 | 定義全域 `.rich-text-content` class，並套用於所有渲染區塊 |

### 列表縮排邏輯

為了維持 HTML 結構的語意化，當在列表項目中增加縮排時，使用的是 Tiptap 核心的 `sinkListItem` 指令（建立巢狀 `ol`/`ul`）；在一般段落時則使用 CSS `margin-left`。

### 狀態: ✅ 已完成

---

## 9. 品質文件 PDF 歷史快照功能恢復 (Phase 20)

### 需求

恢復 PDF 歷史快照使用 Puppeteer 截圖呈現，以支援更複雜的富文本排版與所見即所得效果。

### 技術方案

- 位置: `src/lib/pdf-generator.ts`
- 修改 `generateQCDocument` 邏輯。
- 呼叫 `renderHtmlToImage` 生成 PNG 後嵌入 PDF。
- 支援 A4 比例縮放與高度限制（避免過長圖片破壞版面）。

### 容錯機制

若截圖過程發生錯誤，系統將自動呼叫 `generateHistorySummaryPages` 生成純文字摘要作為備援。

### 狀態: ✅ 已完成

---

## 11. PDF 截斷修復 (Phase 22)

### 需求

原本的歷史快照採用 Puppeteer 截圖 (Image 嵌入) 方式，當內容過長 (超過 1000px) 時會被截斷，無法在 PDF 中完整顯示多頁內容。

### 技術方案

- **從 Image 轉向 PDF**: 不再生成圖片，而是直接利用 Puppeteer 的 PDF 列印功能生成標準 A4 PDF。
- **多頁合併支援**: 使用 `pdf-lib` 的 `copyPages` 功能，將產生的歷史 PDF 頁面逐一拷貝並追加到主文件 (QC 單) 末尾。
- **佈局優化**:
  - 歷史時間軸改為垂直週期佈局，避免水平文字截斷。
  - 圖片 URL 自動轉為絕對路徑，確保 Puppeteer 可順利下載。
  - 關聯項目、參考文獻、附件等 JSON 數據格式化為清單輸出。

### 優點

- **無長度限制**: 自動根據內容長度產生分頁，不再有截斷問題。
- **文字搜尋**: 產生的是向量 PDF 而非圖片，內文可進行關鍵字搜尋。
- **清晰度提升**: 避免圖片縮放導致的模糊問題。

### 狀態: ✅ 已完成
