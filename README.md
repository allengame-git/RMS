# 低放射性廢棄物處置管理系統 (LLRWD-RMS)

> Low-level Radiowaste Disposal Management System - 階層化項目管理與審核流程系統

## 專案概述

LLRWD-RMS 是一個基於 Next.js 開發的專案項目資訊管理系統，提供階層式項目結構、自動編號、變更審核流程、以及多層級權限控管。本系統致力於提供現代化、直覺且全中文化的管理介面。

### 主要功能

- 📁 **專案與項目管理** - 階層式項目結構 (樹狀結構)，支援無限層級子項目、選單摺疊與項目高亮
- 📋 **專案複製功能** - 一鍵複製專案結構，支援選擇性複製項目內容與附件
- ⚖️ **專案治理 (Project Governance)** - 專案編輯與刪除皆納入審核流程，確保異動可控（編輯: Editor+, 刪除: Admin）
- 🔢 **自動編號** - 項目自動產生唯一編號 (如 `WQ-1`, `WQ-1-1`)
- ✅ **審核流程** - 變更申請需經審核 (建立/編輯/刪除)，包含 Project、Item 與 DataFile。支援「待修改申請」管理與取消申請功能。
- 🔄 **QC/PM 複審機制** - 品質文件審核支援退回修訂與重新提交，記錄修訂次數
- 🔍 **專案搜尋** - 專案內全文搜尋，關鍵字高亮顯示，過濾 HTML/JSON 語法
- 🔐 **權限控管** - 四層角色權限 (Viewer/Editor/Inspector/Admin)，自我審核防止機制 (ADMIN 例外)，允許使用者撤回或取消自己的申請
- 📝 **富文本編輯** - 支援文字格式、自定義大小表格 (1x1 ~ 20x20)、圖片、優化 Link 插入流程 (支援同時輸入文字與 URL)
- 📎 **檔案附件** - 支援 PDF、Word、圖片上傳
- 📄 **檔案管理系統** - 獨立檔案管理模組，支援拖放上傳 (100MB)、年份分類、卡片/清單雙視圖、排序、搜尋、審核流程與前後比較
- 🕰️ **項目歷史紀錄** - 完整記錄項目的建立、變更與刪除歷史，支援版本比對 (Diff) 與快照檢視
- 📄 **ISO 品質文件生成** - 項目變更審核通過後自動生成 PDF 品質紀錄單 (結合 pdf-lib 與 Puppeteer 實現高真度多頁歷史快照)
- 🔍 **ISO 文件搜尋與下載** - 支援按專案搜尋文件、顯示最近更新紀錄、直接下載 PDF
- ✍️ **品質文件數位簽章** - 兩階段審核流程 (QC 審核 → PM 核定)，自動嵌入 QC/PM 數位簽名至 PDF
- ✅ **簽核意見自動填入** - 審核者/QC/PM 若未填寫意見，自動填入「同意」
- 📊 **全域變更歷史** - 提供全域變更歷史 Dashboard，最近更新紀錄 (最新100筆，支援篩選項目/檔案)
- 💾 **系統備份與復原** - 完整備份資料庫 (SQL) 與實體檔案 (ZIP)，支援災難復原與進度顯示
- 📂 **單一專案備份與轉移** - 支援單一專案完整匯出/匯入 (ZIP)，含 ID Mapping 與自動備份
- 🎨 **Infographic Bento Grid 首頁** - 採用現代化 Bento Grid 佈局，結合工業風黑白攝影與資料視覺化，呈現系統概覽與待辦事項
- 🎹 **Accordion 樹狀導覽** - 歷史紀錄側邊欄支援展開/摺疊手風琴效果
- 🔍 **詳細審查紀錄** - 歷史詳情頁顯示提交者、核准者、QC、PM 姓名與時間戳記、修訂歷程
- 🌓 **主題切換** - 淺色/深色模式
- 🛡️ **進階認證安全** - 登入審計日誌、密碼複雜度策略、帳號鎖定機制 (5 次失敗鎖 15 分鐘)、Admin 解鎖功能
- 🐳 **容器化部署** - 支援 Docker 部署，包含 Nginx 反向代理與 HTTPS
- ☁️ **Vercel 部署支援** - 支援 Serverless 部署至 Vercel + Neon PostgreSQL

---

## 技術棧

| 類別 | 技術 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 14.2.35 |
| 語言 | TypeScript | ^5 |
| 資料庫 | Prisma + PostgreSQL | Prisma 5.22.0 |
| 認證 | NextAuth.js | ^4.24.13 |
| 編輯器 | Tiptap (ProseMirror-based) | ^3.14.0 |
| PDF 生成 | pdf-lib (純 JavaScript) | ^1.17.1 |
| 狀態管理 | Zustand | ^5.0.9 |
| 樣式 | Vanilla CSS + CSS Variables | - |
| 部署 | Docker + Nginx / Vercel + Neon | - |

---

## 套件依賴說明

以下為系統所有依賴套件的完整說明，確保新環境可順利安裝。

### 核心框架

| 套件 | 說明 | 安裝指令 |
|------|------|----------|
| `next` | Next.js 框架核心 | 已包含在 package.json |
| `react` / `react-dom` | React UI 框架 | 已包含在 package.json |
| `typescript` | TypeScript 語言支援 | 已包含在 devDependencies |

### 資料庫與認證

| 套件 | 說明 |
|------|------|
| `prisma` | 資料庫 ORM 開發工具 (devDependency) |
| `@prisma/client` | Prisma 客戶端，用於資料庫查詢 |
| `next-auth` | 使用者認證系統 (Credentials Provider) |
| `bcryptjs` | 密碼雜湊加密 |

### 富文本編輯器 (Tiptap)

| 套件 | 說明 |
|------|------|
| `@tiptap/react` | Tiptap React 綁定 |
| `@tiptap/starter-kit` | 基礎編輯器功能套件 |
| `@tiptap/extension-image` | 圖片插入功能 |
| `@tiptap/extension-link` | 超連結功能 |
| `@tiptap/extension-table` | 表格主功能 |
| `@tiptap/extension-table-cell` | 表格儲存格 |
| `@tiptap/extension-table-header` | 表格標題列 |
| `@tiptap/extension-table-row` | 表格行 |
| `@tiptap/extension-text-align` | 文字對齊功能 |
| `tiptap-extension-resize-image` | 圖片縮放功能 |

### PDF 生成與處理

| 套件 | 說明 |
|------|------|
| `pdf-lib` | 純 JavaScript PDF 生成/修改函式庫 (主要使用) |
| `@pdf-lib/fontkit` | 自定義字型嵌入支援 (中文字型) |
| `puppeteer` | (可選) 無頭瀏覽器，用於舊版 HTML 渲染 |
| `pdfkit` | (備用) PDF 生成函式庫 |

> 💡 **PDF 生成說明**: 系統已改用純 `pdf-lib` 方式生成 PDF，不再依賴 Puppeteer。Puppeteer 僅作為舊版相容保留。

### 檔案處理

| 套件 | 說明 |
|------|------|
| `adm-zip` | ZIP 檔案壓縮/解壓縮 (系統備份、專案匯入還原) |
| `archiver` | ZIP 檔案壓縮 (專案匯出備份) |

### UI 工具

| 套件 | 說明 |
|------|------|
| `clsx` | 條件式 CSS class 名稱組合工具 |
| `zustand` | 輕量級前端狀態管理 |
| `react-easy-crop` | 圖片裁切功能 (簽名上傳) |

### 開發工具 (devDependencies)

| 套件 | 說明 |
|------|------|
| `eslint` / `eslint-config-next` | 程式碼品質檢查 |
| `vitest` | 單元測試框架 |
| `@types/*` | TypeScript 型別定義 |

## 資料庫遷移 (2026/01)

本專案已從 SQLite 遷移至 **PostgreSQL** 以提升效能與擴展性。詳細遷移流程請參考 [docs/postgresql_migration_plan.md](docs/postgresql_migration_plan.md)。

> 💡 **開發環境**: 若需切換回 SQLite（僅限本地測試），請參考 `prisma/schema.prisma` 中的註解並切換 provider。

---

## 快速開始

### 安裝依賴

```bash
npm install
```

### 初始化資料庫

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

> 💡 **注意**: `db seed` 會建立預設管理員帳號 `admin` / `adminpassword`。新環境部署後務必執行此指令。

### 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 即可使用。

---

## 預設帳號

| 角色 | 帳號 | 密碼 |
|------|------|------|
| Admin | admin | adminpassword|

---

## 權限說明

| 角色 | 瀏覽 | 提交變更 | 審核 | 管理使用者 |
|------|:----:|:--------:|:----:|:----------:|
| Viewer | ✅ | ❌ | ❌ | ❌ |
| Editor | ✅ | ✅ | ❌ | ❌ |
| Inspector | ✅ | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ |

---

## 專案結構

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── admin/             # 管理後台 (審核、使用者、歷史)
│   ├── projects/          # 專案頁面
│   ├── items/             # 項目頁面
│   ├── datafiles/         # 檔案管理頁面
│   └── iso-docs/          # ISO 品質文件頁面
├── actions/               # Server Actions
├── components/            # React 元件
│   ├── editor/           # 富文本編輯器
│   ├── item/             # 項目相關
│   ├── datafile/         # 檔案管理相關
│   ├── history/          # 歷史紀錄相關
│   └── layout/           # 佈局元件
└── lib/                   # 工具函式
```

---

## 文件

| 文件 | 說明 |
|------|------|
| [docs/task.md](docs/task.md) | 開發進度追蹤 |
| [docs/tech.md](docs/tech.md) | 技術文件 |
| [docs/implementation_plan.md](docs/implementation_plan.md) | 功能實作計畫 |
| [docs/deployment_guide.md](docs/deployment_guide.md) | Windows 部署規劃 |
| [docs/deployment_steps.md](docs/deployment_steps.md) | Step-by-Step 部署指南 |
| [docs/deployment_checklist.md](docs/deployment_checklist.md) | 部署檢驗清單 |

---

## 開發指令

```bash
# 開發模式
npm run dev

# 建置
npm run build

# 正式環境
npm start

# Prisma Studio (資料庫 GUI)
npx prisma studio

# 更新 Prisma Client
npx prisma generate
```

---

## Docker 部署

```bash
# 建置映像
docker compose build

# 啟動服務
docker compose up -d

# 查看日誌
docker compose logs -f
```

---

## License

MIT
