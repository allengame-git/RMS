# 低放射性廢棄物處置管理系統 - 開發進度 (task.md)

>> 最後更新: 2026-01-20

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
| Phase 9 | 管理員自我編輯功能 | ✅ 完成 |
| Phase 10 | 品質文件 PDF 優化 | ✅ 完成 |
| Phase 11 | 變更申請退回優化 | ✅ 完成 |
| Phase 12 | ISO 文件頁面優化 | ✅ 完成 |
| Phase 16 | QC/PM 複審流程 | ✅ 完成 |
| Phase 17 | 專案複製功能 | ✅ 完成 |
| Phase 18 | PDF-lib 重構與 Vercel 部署 | ✅ 完成 |
| Phase 19 | 富文本編輯器強化 (巢狀編號、縮排) | ✅ 完成 |
| Phase 20 | 品質文件 PDF 歷史快照功能恢復 (截圖方式) | ✅ 完成 |
| Phase 21 | 品質文件 PDF 歷史快照強化 (時間軸與 Diff) | ✅ 完成 |
| Phase 22 | PDF 截斷修復 (支援多頁分頁) | ✅ 完成 |
| Phase 23 | 專案頁面中文化與 UI 優化 | ✅ 完成 |
| Phase 24 | 刪除流程優化與通知中心 UI 更新 | ✅ 完成 |
| Phase 25 | 單一專案備份與轉移功能 | ✅ 完成 |
| Phase 26 | PDF 重構與資料庫還原優化 | ✅ 完成 |

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

## Phase 10: 品質文件 PDF 優化 (v1.2.0) ✅

### Phase 10.1: PDF 結構優化 ✅

- [x] 移除舊版文字預覽，改為標準化表單
- [x] 強制單一檔案策略 (`QC-[Project]-[ID].pdf`)
- [x] PDF 內含詳細簽核資訊 (提交者/核准者/QC/PM)

### Phase 10.2: 內容附件截圖 ✅

- [x] PM 核准後自動截圖完整歷史頁面 (Puppeteer)
- [x] 包含 Diff 變更比對與 Snapshot 內容
- [x] 使用 `pdf-lib` 合併 PDF 頁面

### Phase 10.3: 審核流程優化 ✅

- [x] 簽核意見自動填入「同意」(審查者/QC/PM)
- [x] Next.js Config 設定 `serverComponentsExternalPackages`

---

## Phase 11: 變更申請退回優化 (v1.3.0) ✅

### Phase 11.1: 待修改申請管理 ✅

- [x] 建立 `/admin/rejected-requests` 列表頁
- [x] 建立編輯與重新提交頁面 (自動帶入舊資料)
- [x] 支援關聯項目 (Related Items) 帶入與編輯

### Phase 11.2: 流程整合 ✅

- [x] 重新提交後自動清除原退回項目 (狀態更新)
- [x] Navbar 新增「待修改」計數 Badge
- [x] API `/api/rejected-count` 實作

---

## Phase 12: ISO 文件頁面優化 (v1.4.0) ✅

### Phase 12.1: 頁面結構重構 ✅

- [x] **分組顯示**: `/iso-docs` 改為依專案分組顯示
- [x] **統計資訊**: 顯示專案文件數量與最後更新時間
- [x] **專案詳情頁**: 新增 `/iso-docs/[projectId]` 頁面

### Phase 12.2: 最近更新紀錄 ✅

- [x] 新增「最近更新紀錄」區塊 (顯示最新 50 筆)
- [x] 顯示詳細狀態 (待修訂、待 QC/PM 審核、已核准等)
- [x] 支援顯示修訂次數 (Revision Count)
- [x] 新增「下載」按鈕欄位，直接連結 PDF 檔案

### Phase 12.3: 搜尋功能 ✅

- [x] 新增全域搜尋 (關鍵字: 文件編號、標題、專案)
- [x] Client Side Search Component (`IsoDocSearch`)
- [x] 整合至專案列表與最近更新紀錄篩選

---

## Phase 13: 系統全面中文化與 UI 現代化 (v1.5.0) ✅

### Phase 13.1: 頁面中文化 ✅

- [x] `/projects` 專案列表頁 (標題、描述、按鈕、Modal)
- [x] `/admin/users` 使用者管理頁 (表格、欄位、Modal、錯誤訊息)
- [x] `/admin/rejected-requests` 待修改申請頁
- [x] Login 頁面 ("會員登入" -> "使用者登入")

### Phase 13.2: Bento Grid 首頁改版 ✅

- [x] 採用現代化 Bento Grid 佈局 (5 Card Layout)
- [x] 整合工業風黑白攝影 (Drone, Tunnel, Coast)
- [x] 資料視覺化 (Stat Cards, Pending Actions List)
- [x] 移除多餘遮罩與干擾元素，優化閱讀體驗

---

## Phase 14: 變更申請取消流程 (v1.6.0) ✅

### Phase 14.1: 取消申請功能 ✅

- [x] Server Action: `cancelRejectedRequest` (支援權限檢查)
- [x] UI Component: `CancelRequestButton` (Client Component)
- [x] 整合至 `/admin/rejected-requests` 頁面
- [x] 權限邏輯: 僅限原提交者或 Admin 可執行

---

## Phase 15: 系統備份與復原 (v1.7.0) ✅

### Phase 15.1: 備份功能 ✅

- [x] 資料庫備份 (PostgreSQL SQL Export)
- [x] 檔案備份 (Uploads, ISO Docs ZIP)
- [x] 管理者備份介面 (Admin Dashboard UI)
- [x] 串流下載 (Stream Response)

### Phase 15.2: 復原功能 ✅

- [x] 資料庫復原 (SQL Import with Session Validation)
- [x] 檔案復原 (ZIP Extract)
- [x] 進度條與狀態顯示 (Progress Bar)
- [x] 備份檔案完整性檢查
- [x] 復原完成後自動登出機制

---

## Phase 16: QC/PM 複審流程 (v1.8.0) ✅

### Phase 16.1: 複審機制 ✅

- [x] QCDocumentApproval 模型新增 `revisionCount` 欄位
- [x] 新增 `REVISION_REQUIRED` 狀態 (要求修訂)
- [x] QC/PM 可選擇「核准」或「要求修訂」
- [x] 修訂後自動變更狀態為 `PENDING_QC` 或 `PENDING_PM`

### Phase 16.2: UI 整合 ✅

- [x] 審核頁面新增「要求修訂」按鈕
- [x] 品質文件狀態顯示修訂次數
- [x] 歷史詳情頁顯示完整複審歷程 (Timeline)
- [x] `ReviewProcessTimeline` 元件支援 revisions 陣列

---

## Phase 17: 專案複製功能 (v1.8.0) ✅

### Phase 17.1: 後端實作 ✅

- [x] Server Action: `duplicateProject(projectId, newTitle, newPrefix)`
- [x] 遞迴複製項目結構 (深層複製)
- [x] 保持 fullId 自動重新計算
- [x] 選擇性複製項目內容與附件

### Phase 17.2: 前端整合 ✅

- [x] 專案卡片新增「複製」按鈕
- [x] 複製對話框 (輸入新專案名稱與編碼)
- [x] 複製完成後自動跳轉至新專案

---

## Phase 18: PDF-lib 重構與 Vercel 部署 (v1.8.0) ✅

### Phase 18.1: PDF 生成重構 ✅

- [x] 移除 Puppeteer 依賴 (降低套件大小)
- [x] 改用 pdf-lib 純文字渲染歷史摘要
- [x] `generateHistorySummaryPages` 直接生成 PDF 頁面
- [x] 維持簽名嵌入功能 (`embedSignatureInPDF`)

### Phase 18.2: Vercel 部署支援 ✅

- [x] 動態路由加入 `force-dynamic` 防止靜態預渲染
- [x] 移除 API Route 中的 fs 寫入操作 (Serverless 相容)
- [x] 建立 Neon PostgreSQL 連線指南
- [x] 撰寫 `docs/freespace_deployment.md` 部署文件

---

## Phase 19: 富文本編輯器強化 (v1.9.0) ✅

### Phase 19.1: 巢狀編號與列表 ✅

- [x] 實作有序列表 (ol) 的巢狀編號功能 (1., 1.1, 1.2.1)
- [x] 使用 CSS Counters 實現動態編號渲染
- [x] 修復編號版面跑位 (跨行顯示問題)

### Phase 19.2: 段落縮排與對齊 ✅

- [x] 實作自定義 `Indent` Tiptap 擴充套件
- [x] 整合 Tab (增加縮排) 與 Shift+Tab (減少縮排) 快捷鍵
- [x] 優化縮排邏輯：列表項目使用 `sinkListItem`/`liftListItem`，一般段落使用 `margin-left`

### Phase 19.3: 全域樣式整合 ✅

- [x] 提取富文本樣式至 `globals.css` 中的 `.rich-text-content`
- [x] 確保「項目詳情」、「審核清單」、「歷史版本」、「退回申請」樣式一致
- [x] 整合 `TextAlign` 擴充套件並配置文字對齊樣式

---

## Phase 20: 品質文件 PDF 歷史快照功能恢復 (v1.9.1) ✅

### Phase 20.1: 功能恢復 ✅

- [x] 將品質文件第二頁的歷史快照改回使用 Puppeteer 截圖
- [x] 整合 `renderHtmlToImage` 確保富文本排版完整性
- [x] 實作截圖失敗時的文字摘要降級機制 (Fallback)

---

## Phase 21: 品質文件 PDF 歷史快照強化 (v1.9.2) ✅

### Phase 21.1: HTML 模板與樣式強化 ✅

- [x] 在 `pdf-generator.ts` 構建包含時間軸與 Diff 的 HTML 模板
- [x] 注入 `.rich-text-content` 與時間軸專用 CSS
- [x] 支援 `history.reviewChain` 渲染多輪審核紀錄
- [x] 支援 `history.diff` 渲染變更前後對照卡片
- [x] 整合至 `generateQCDocument` 並驗證截圖完整性

---

## Phase 22: PDF 截斷修復 (支援多頁分頁) ✅

### Phase 22.1: 改用 Puppeteer PDF 生成 ✅

- [x] 在 `html-renderer.ts` 實作 `renderHtmlToPdf`
- [x] 在 `pdf-generator.ts` 改用 PDF 合併模式
- [x] 移除 1000px 高度限制，支援自然分頁
- [x] 保持文字清晰度與可搜尋性
- [x] 修復通知頁面「刪除已讀」按鈕閃退問題 (改用 custom ConfirmDialog)

---

## Phase 23: 專案頁面中文化與 UI 優化 ✅

### Phase 23.1: 專案詳情頁面中文化 ✅

- [x] `/projects/[id]` 頁面返回連結中文化 (返回專案列表)
- [x] 「Items」→「項目列表」
- [x] 空狀態訊息中文化 (尚無項目資料)

### Phase 23.2: 移除 Emoji 圖示 ✅

- [x] `ProjectSearchBar.tsx` - 🔍 改為 SVG 搜尋圖示
- [x] `SearchResultList.tsx` - 🔍 空狀態改為 SVG
- [x] `CreateItemForm.tsx` - ✕ 改為 SVG X 圖示，加入動畫效果
- [x] `RelatedItemsManager.tsx` - 📎 改為 SVG 連結圖示
- [x] `ReferencesManager.tsx` - 📚📄🔍✓ 改為 SVG

### Phase 23.3: 彈出視窗 UI 優化 ✅

- [x] 新增項目表單優化 (標題區域、欄位樣式)
- [x] 加入進場動畫 (fadeIn, slideUp)
- [x] 關閉按鈕 hover 效果
- [x] 提交按鈕加入圖示與 loading 狀態

### Phase 23.4: 文件更新 ✅

- [x] 更新 `README.md` - 加入完整套件依賴說明
- [x] 更新 `docs/tech.md` - 加入套件依賴完整清單
- [x] 更新 `docs/task.md` - 加入 Phase 23

---

## Phase 25: 單一專案備份與轉移功能 (v2.0.0) ✅

### Phase 25.1: 後端服務 ✅

- [x] 建立 `src/lib/backup/export-service.ts` - 專案匯出 ZIP 服務
- [x] 建立 `src/lib/backup/import-service.ts` - 專案匯入服務 (含 ID mapping)
- [x] 實作 14 步驟嚴格匯入順序 (含兩階段 UPDATE)
- [x] 新增 `/api/admin/backup/project/[id]` - 專案匯出 API
- [x] 新增 `/api/admin/restore/project` - 專案匯入 API (含自動備份)
- [x] 新增 `/api/projects` - 專案列表 API

### Phase 25.2: 前端 UI ✅

- [x] 建立 `ProjectBackupSection.tsx` - 專案備份/匯入介面
- [x] 修改 `BackupRestoreSection.tsx` - 新增 Tab 切換 (系統級/單一專案)
- [x] 專案選擇下拉選單
- [x] 匯入確認對話框 (需輸入 IMPORT)
- [x] 匯入前自動執行全系統備份

### Phase 25.3: 資料安全 ✅

- [x] ID Mapping 機制 - 所有 ID 匯入時重新生成
- [x] codePrefix 衝突處理 - 自動重新命名 (加 `_imported` 後綴)
- [x] 匯入前自動備份 - 執行 `pg_dump` 產生 SQL 檔案
- [x] 交易模式 - 使用 Prisma `$transaction` 確保原子性

---

## Phase 26: PDF 重構與資料庫還原優化 (v2.1.0) ✅

### Phase 26.1: PDF 生成重構 ✅

- [x] 移除 Puppeteer 依賴 - PDF 第二頁改用純 `pdf-lib` 渲染
- [x] 移除審核時間軸 - 第一頁已有相關內容，避免重複
- [x] 清理未使用的 imports - 移除 `html-renderer` 相關

### Phase 26.2: 資料庫還原優化 ✅

- [x] 支援直接上傳 `.sql` 檔案還原 (原本只支援 `.zip`)
- [x] 更新 BackupRestoreSection UI - accept 改為 `.zip,.sql`
- [x] 完整 SQL 內容驗證 (INSERT/User/Admin 檢查)

### Phase 26.3: 專案匯入修復 ✅

- [x] 替換 `unzipper` 為 `adm-zip` (解決 AWS SDK 建置錯誤)
- [x] 更新 import-service.ts 使用 Buffer 參數
- [x] 清理未使用的套件引用

### Phase 26.4: 文件更新 ✅

- [x] 更新 README.md - PDF 改為 pdf-lib 主要使用
- [x] 更新 docs/tech.md - 套件清單同步更新
- [x] 更新 docs/task.md - 新增 Phase 26 紀錄
