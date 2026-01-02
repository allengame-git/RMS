# 專案項目資訊管理系統 (RMS)

> Requirements Management System - 階層化項目管理與審核流程系統

## 專案概述

RMS 是一個基於 Next.js 開發的專案項目資訊管理系統，提供階層式項目結構、自動編號、變更審核流程、以及多層級權限控管。

### 主要功能

- 📁 **專案與項目管理** - 階層式項目結構 (樹狀結構)，支援無限層級子項目、選單摺疊與項目高亮
- ⚖️ **專案治理 (Project Governance)** - 專案編輯與刪除皆納入審核流程，確保異動可控（編輯: Editor+, 刪除: Admin）
- 🔢 **自動編號** - 項目自動產生唯一編號 (如 `WQ-1`, `WQ-1-1`)
- ✅ **審核流程** - 變更申請需經審核 (建立/編輯/刪除)，包含 Project、Item 與 DataFile，優化的 Dashboard UI 與防呆機制
- 🔍 **專案搜尋** - 專案內全文搜尋，關鍵字高亮顯示，過濾 HTML/JSON 語法
- 🔐 **權限控管** - 四層角色權限 (Viewer/Editor/Inspector/Admin)，自我審核防止機制 (ADMIN 例外)
- 📝 **富文本編輯** - 支援文字格式、自定義大小表格 (1x1 ~ 20x20)、圖片、優化 Link 插入流程 (支援同時輸入文字與 URL)
- 📎 **檔案附件** - 支援 PDF、Word、圖片上傳
- 📄 **檔案管理系統** - 獨立檔案管理模組，支援檔案上傳 (100MB)、年份分類、卡片/清單雙視圖、排序、搜尋、審核流程與前後比較
- 🕰️ **項目歷史紀錄** - 完整記錄項目的建立、變更與刪除歷史，支援版本比對 (Diff) 與快照檢視
- 📊 **全域變更歷史** - 提供全域變更歷史 Dashboard，所有使用者皆可瀏覽專案變更與已刪除項目
- 🎨 **統一 UI 設計** - 所有對話框採用 glass modal 設計，backdrop blur 效果
- 🌓 **主題切換** - 淺色/深色模式

---

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| 語言 | TypeScript |
| 資料庫 | Prisma + SQLite |
| 認證 | NextAuth.js |
| 編輯器 | Tiptap (ProseMirror) |
| 樣式 | Vanilla CSS + CSS Variables |

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
```

### 建立預設管理員 (可選)

```bash
npx prisma db seed
```

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
│   ├── admin/             # 管理後台 (審核、使用者)
│   ├── projects/          # 專案頁面
│   ├── items/             # 項目頁面
│   └── datafiles/         # 檔案管理頁面
├── actions/               # Server Actions
├── components/            # React 元件
│   ├── editor/           # 富文本編輯器
│   ├── item/             # 項目相關
│   ├── datafile/         # 檔案管理相關
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
| [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) | 下次開始指南 |

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

## License

MIT
