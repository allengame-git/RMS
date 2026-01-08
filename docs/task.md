# 專案項目資訊管理系統 - 開發進度 (task.md)

>> 最後更新: 2026-01-07

## 進度總覽

| Phase | 說明 | 狀態 |
|-------|------|------|
| Phase 1 | 專案初始化與基礎建設 | ✅ 完成 |
| Phase 2 | 核心功能開發 | ✅ 完成 |
| Phase 3 | 進階內容功能 | ✅ 完成 |
| Phase 4 | UI 優化與測試 | ✅ 完成 |
| Phase 5 | 檔案管理系統 | ✅ 完成 |
| Phase 6 | 部署準備與優化 | ✅ 完成 |
| Phase 7 | 品質文件數位簽章 | ✅ 完成 |
| Phase 8 | UI/UX 優化與強化 | ✅ 完成 |

---

## Phase 1: 專案初始化與基礎建設

- [x] 建立專案結構 (Next.js 14 + TypeScript)
- [x] 設計資料庫 Schema (Prisma + SQLite)
  - User, Project, Item, ChangeRequest 模型
- [x] 設定基礎 UI Design System (CSS Variables)
- [x] 實作身份驗證系統 (NextAuth.js)
- [x] 實作權限系統 (Admin/Editor/Viewer)
- [x] **[檢核]** DB Schema 與 Auth 功能正常 ✅

## Phase 2: 核心功能開發 - 資料結構與管理

- [x] 實作專案 (Project) CRUD
- [x] 實作項目 (Item) 自動編號邏輯
- [x] 實作審核流程 (Change Request Workflow)
  - 提交申請 → 待審核 → 核准/退回
- [x] 實作項目展示頁面 (Viewer View)
- [x] **[檢核]** 專案建立、自動編號、審核流程正常 ✅

## Phase 3: 進階內容功能

- [x] 整合 Rich Text Editor (Tiptap)
  - 支援 Bold, Italic, Heading, Table
- [x] 實作檔案上傳功能 (PDF, Word, Images)
- [x] 實作標籤連結功能 (跨專案 Item 連結)
- [x] 實作關聯項目 (Related Items) 功能
- [x] 實作階層式項目結構 (Tree View)
- [x] **[檢核]** 富文本、檔案上傳、標籤連結功能正常 ✅

## Phase 4: UI 優化與測試

### Phase 4.0: 主題與基礎優化 ✅

- [x] 實作主題切換功能 (Light/Dark Mode)
- [x] 優化 CSS 變數系統

### Phase 4.1: 使用者權限管理系統 ✅

- [x] 設計四層權限分級 (Viewer/Editor/Inspector/Admin)
- [x] 實作使用者管理 Server Actions (CRUD)
- [x] 實作使用者管理 UI (Admin Dashboard)
- [x] Admin 編輯使用者功能 (Username/Role/Password Reset)
- [x] 密碼欄位顯示切換功能
- [x] 更新審核權限邏輯 (Inspector 可審核)
- [x] **[檢核]** 各角色權限行為正確 ✅

### Phase 4.2-4.9 ✅

- [x] 項目編輯/刪除審核流程
- [x] Rich Text Editor 圖片功能增強
- [x] Approval Dashboard 優化
- [x] Project Management Enhancements
- [x] Item History & Global Dashboard
- [x] Project Search Feature
- [x] UI Dialog Improvements & Self-Approval Prevention

---

## Phase 5: 檔案管理系統 (v0.8.0) ✅

### Phase 5.1: Database Schema & Backend ✅

- [x] DataFile, DataFileChangeRequest, DataFileHistory 模型
- [x] Server Actions (Query, Request, Approval)
- [x] File Upload API (100MB limit)

### Phase 5.2: Frontend Pages & Components ✅

- [x] `/datafiles` - 檔案列表頁 (年份篩選、搜尋)
- [x] `/datafiles/upload` - 檔案上傳頁 (支援拖放)
- [x] `/datafiles/[id]` - 檔案詳情頁
- [x] 卡片/清單雙視圖、多欄位排序

### Phase 5.3: Features & Enhancements ✅

- [x] 拖放上傳功能 (Drag & Drop)
- [x] 表單欄位必要性調整 (年份/名稱/作者/檔案必填)
- [x] 審核流程整合與前後比較
- [x] **[檢核]** 檔案管理完整功能正常 ✅

---

## Phase 6: 部署準備與優化 (v0.9.0) ✅

### Phase 6.1: Approval Dashboard 中文化 ✅

- [x] 項目變更申請卡片中文化
- [x] 檔案變更申請卡片中文化
- [x] 確認對話框中文化
- [x] 移除 Root Item / Child Item 標籤

### Phase 6.2: 審核權限調整 ✅

- [x] 允許使用者拒絕自己的申請 (撤回功能)
- [x] 批准仍需其他審核人員 (ADMIN 例外)

### Phase 6.3: 內容比較優化 ✅

- [x] 項目變更申請「內容」欄位修改前後比較

### Phase 6.4: 全域歷史 Dashboard ✅

- [x] 頁面中文化
- [x] 新增「最近更新紀錄」區塊 (最新100筆)
- [x] 支援篩選功能 (全部/項目/檔案)

### Phase 6.5: Docker 部署準備 ✅

- [x] 建立 Dockerfile
- [x] 建立 docker-compose.yml
- [x] 建立 nginx/nginx.conf (HTTPS 反向代理)
- [x] 建立健康檢查 API (`/api/health`)
- [x] 編寫 Windows PowerShell 備份/還原腳本
- [x] 編寫部署文件 (deployment_guide.md, deployment_steps.md)
- [x] 編寫檢驗清單 (deployment_checklist.md)

---

## Phase 7: 品質文件數位簽章 (v1.0.0) ✅

### Phase 7.1: 使用者資格設定 ✅

- [x] User 模型新增 `isQC`, `isPM`, `signaturePath` 欄位
- [x] 使用者管理頁面支援設定 QC/PM 資格與簽名上傳

### Phase 7.2: QCDocumentApproval 模型 ✅

- [x] 新增 `QCDocumentApproval` 資料表
- [x] 狀態流程: PENDING_QC → PENDING_PM → COMPLETED / REJECTED

### Phase 7.3: 後端審核 Actions ✅

- [x] `src/actions/qc-approval.ts` - 審核流程邏輯
- [x] `approveAsQC()` / `approveAsPM()` / `rejectQCDocument()`
- [x] 審核時自動嵌入數位簽名至 PDF

### Phase 7.4: 前端整合 ✅

- [x] `/admin/approval` 頁面新增「品質文件審核」區塊
- [x] `QCDocumentApprovalList.tsx` 元件
- [x] 根據使用者資格顯示待審核文件

### Phase 7.5: PDF 生成優化 ✅

- [x] 改用 `pdf-lib` 取代 `pdfkit` (解決 Next.js 相容性問題)
- [x] 使用 Puppeteer 截圖渲染富文本內容
- [x] 簽名圖片嵌入與位置調整

---

## Phase 8: UI/UX 優化與強化 (v1.1.0) ✅

### Phase 8.1: 首頁儀表板改版 ✅

- [x] Infographic 風格視覺設計
- [x] 新增全域色彩變數 (Teal, Orange, Yellow, Navy)
- [x] 三卡片佈局 (系統概覽、近期活動、待辦事項)
- [x] 動態數據統計 (專案數、項目數、檔案數、待審核數)

### Phase 8.2: 側邊欄導覽強化 ✅

- [x] `SidebarNav` 新增子項目功能還原 (canEdit, projectId props)
- [x] `HistorySidebar` 改為 Accordion (手風琴) 效果
- [x] 樹狀結構從 fullId 自動建立
- [x] 展開/摺疊動畫效果

### Phase 8.3: 歷史詳情頁優化 ✅

- [x] 審查紀錄詳情卡片 (提交者、核准者、QC、PM)
- [x] 顯示各階段姓名與時間戳記
- [x] 備註區塊顯示

---

## Phase 9: 管理員自我編輯功能 ✅

### Phase 9.1: 前端實作 ✅

- [x] 啟用 Admin 編輯自己按鈕
- [x] 編輯 Modal Role 防呆 (鎖定不可降級)
- [x] 驗證密碼修改流程

---

## 已完成功能總覽

- ✅ 專案與項目 CRUD
- ✅ 階層式項目結構 (無限層級)
- ✅ 自動編號系統
- ✅ 審核流程 (CREATE/UPDATE/DELETE)
- ✅ 四層權限控管
- ✅ 富文本編輯器 (含圖片、表格)
- ✅ 檔案附件管理
- ✅ 檔案管理系統 (獨立模組)
- ✅ 拖放上傳
- ✅ 專案搜尋 (關鍵字高亮)
- ✅ 項目歷史與版本比較
- ✅ 全域變更歷史 Dashboard
- ✅ ISO 品質文件生成
- ✅ 品質文件數位簽章 (QC/PM 兩階段審核)
- ✅ PDF 內容截圖渲染 (Puppeteer)
- ✅ 中文化介面
- ✅ Docker 部署配置
- ✅ Infographic 風格首頁儀表板
- ✅ 歷史記錄側邊欄 Accordion 效果
- ✅ 詳細審查紀錄資訊顯示
