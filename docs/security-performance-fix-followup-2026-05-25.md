# 資安與效能修復 — 後續步驟

日期：2026-05-25

依據 `docs/security-performance-code-review-2026-05-25.md` 審查報告，已完成全部 10 項修復。本文件記錄部署前必要步驟、驗證清單與未來可考慮的進階改善。

---

## 一、部署前必要步驟

### 1. 套用資料庫索引遷移

PERF-05 新增了 4 組複合索引，需產生並套用 migration。

#### 前置：確認 PostgreSQL 使用者權限

Prisma migrate 需要 `CREATE` schema 權限與 `CREATEDB` 權限（用於建立 shadow database）。若執行 migrate 時出現 `P1010: User was denied access` 錯誤，需先授權。

**Conda 安裝的 PostgreSQL：**

```bash
# Conda 環境下，初始化時的系統使用者即為超級使用者
# 直接用該使用者連線授權
psql -d rms_db -c "GRANT ALL ON SCHEMA public TO rms_user;"
psql -d rms_db -c "ALTER USER rms_user CREATEDB;"
```

**Docker 部署的 PostgreSQL：**

```bash
# POSTGRES_USER 即為超級使用者，用該身份連線
docker exec -it <container_name> psql -U rms_user -d rms_db -c "GRANT ALL ON SCHEMA public TO rms_user;"
docker exec -it <container_name> psql -U rms_user -d rms_db -c "ALTER USER rms_user CREATEDB;"
```

> 將 `<container_name>` 替換為實際的 PostgreSQL container 名稱（如 `rms-postgres`）。

**系統安裝的 PostgreSQL (Homebrew/apt)：**

```bash
# 使用 postgres 超級使用者連線
# macOS Homebrew: 超級使用者為系統帳號（如 allen），省略 -U 即可
# Linux: 使用 sudo -u postgres
psql -d rms_db -c "GRANT ALL ON SCHEMA public TO rms_user;"
psql -d rms_db -c "ALTER USER rms_user CREATEDB;"
```

> **注意：** 若本機同時執行 Homebrew PostgreSQL 與 Docker PostgreSQL（都綁定 port 5432），Prisma 會連到本機的 Homebrew 實例。需先停止本機 PostgreSQL（`brew services stop postgresql@16`），或將 Docker 映射改為其他 port（如 `5433:5432`）並更新 `.env` 中的 `DATABASE_URL`。

#### 執行遷移

```bash
npx prisma migrate dev --name add-composite-indexes
```

正式環境部署時：

```bash
npx prisma migrate deploy
```

### 2. 設定管理員密碼環境變數

SEC-03 移除了硬編碼密碼。Seed 前必須設定：

```bash
export ADMIN_PASSWORD="YourStr0ngP@ssword"   # 至少 12 字元，含大小寫與數字
export ADMIN_USERNAME="admin"                 # 可選，預設 admin
npx prisma db seed
```

未設定 `ADMIN_PASSWORD` 或密碼強度不足時，seed 會拒絕執行。

### 3. 重裝依賴並執行測試

```bash
npm ci
npx vitest run
```

確認 `src/__tests__/datafiles-upload-validation.test.ts` (SEC-01 路徑穿越測試) 通過。

### 4. CSP 標頭驗證

SEC-04 加入的 Content-Security-Policy 可能影響特定頁面功能。啟動 dev server 後確認：

- Tiptap 編輯器正常運作（inline styles 需 `unsafe-inline`）
- 圖片上傳/貼上/拖放正常（`img-src` 含 `data:` `blob:`）
- PDF 預覽/下載正常
- 無 CSP 違規錯誤（開發者工具 Console）

如正式環境使用 CDN 或外部字型，需調整 CSP 的 `font-src`、`style-src`。

---

## 二、本次修復清單

| # | 類型 | 項目 | 修改檔案 |
|---|------|------|----------|
| 1 | SEC-01 | `dataYear` 路徑穿越防護 | `src/app/api/datafiles/upload/route.ts` |
| 2 | SEC-02 | MIME 與副檔名一致性驗證 | `src/app/api/upload/route.ts`, `src/app/api/datafiles/upload/route.ts` |
| 3 | SEC-03 | 移除硬編碼管理員密碼 | `scripts/seed-admin.ts`, `.env.example`, `CLAUDE.md` |
| 4 | SEC-04 | 全站安全標頭 (CSP 等) | `next.config.mjs` |
| 5 | SEC-05 | 登入失敗計數原子更新 | `src/lib/auth.ts` |
| 6 | PERF-01 | 專案頁 items select 最佳化 | `src/app/projects/[id]/page.tsx` |
| 7 | PERF-02 | 6 處列表查詢加分頁 | `src/actions/approval.ts`, `src/actions/data-files.ts`, `src/actions/qc-approval.ts`, `src/actions/history.ts` |
| 8 | PERF-03 | 搜尋查詢 case-insensitive | `src/actions/search.ts`, `src/actions/data-files.ts` |
| 9 | PERF-04 | 檔案下載改串流 + 還原加大小上限 | `src/app/uploads/[...path]/route.ts`, `src/app/iso_doc/[filename]/route.ts`, `src/app/api/admin/restore/uploads/route.ts`, `src/app/api/admin/restore/iso-docs/route.ts` |
| 10 | PERF-05 | 新增 4 組複合索引 | `prisma/schema.prisma` |

統計：18 檔案，+236 / -58 行。TypeScript 編譯零錯誤。

---

## 三、功能驗證清單

部署後建議依下列路徑逐項確認：

### 資安相關

- [ ] 上傳資料檔，`dataYear` 欄位送 `../2024` → 應回傳 400 錯誤
- [ ] 上傳 `.exe` 檔案但偽造 MIME 為 `image/jpeg` → 應回傳「檔案類型與副檔名不一致」
- [ ] 未設定 `ADMIN_PASSWORD` 執行 `npx prisma db seed` → 應拒絕並提示
- [ ] 開發者工具檢查 Response Headers 包含 `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Content-Security-Policy`
- [ ] 連續 5 次錯誤登入 → 帳號鎖定 15 分鐘

### 效能相關

- [ ] 專案頁載入大量 Items 的專案 → Network 回傳不含 `content` 欄位
- [ ] 審核頁、資料檔頁、歷史頁 → 最多回傳 100-200 筆（視各 API 預設值）
- [ ] 搜尋資料檔輸入小寫關鍵字 → 能匹配大寫資料名稱
- [ ] 下載大檔案 → 瀏覽器立即開始下載（非等待整檔讀完才回傳）
- [ ] 還原超過 500MB 的備份 ZIP → 應回傳「還原檔案大小超過限制」

---

## 四、未來進階改善（非本次範圍）

以下為 code review 中提及但需更多規劃的改善方向：

### 搜尋進階優化

- 導入 PostgreSQL `pg_trgm` 擴充並建立 GIN index，大幅提升 `%keyword%` 查詢效能
- Rich text 內容另存純文字欄位，用 `tsvector` 做全文搜尋與相關度排序
- 考慮引入外部搜尋引擎（如 Meilisearch）處理跨模型搜尋

### 前端分頁 UI

- Server Actions 已支援 `take`/`skip` 參數，前端需配套：
  - 審核頁面加入分頁控制元件
  - 資料檔列表加入分頁或無限捲動
  - 歷史頁面加入日期區間篩選 + 分頁
- 考慮 cursor-based pagination 取代 offset pagination（避免大 offset 效能問題）

### 上傳檔案 Magic Number 驗證

- 目前僅驗證 MIME type + 副檔名一致性
- 進階可加入檔頭 magic bytes 驗證（如 PDF 的 `%PDF-`、JPEG 的 `FF D8 FF`）
- 可使用 `file-type` npm 套件自動偵測

### 首次登入強制改密碼

- SEC-03 已移除硬編碼密碼，但未實作首次登入改密碼流程
- 可在 User model 加入 `mustChangePassword` 欄位
- 登入後若為 `true` 則導向改密碼頁面

---

## 五、相關文件

| 文件 | 說明 |
|------|------|
| `docs/security-performance-code-review-2026-05-25.md` | 原始 code review 報告 |
| `CLAUDE.md` | 專案開發指南（已同步更新 seed 說明） |
| `.env.example` | 環境變數範本（已新增 `ADMIN_PASSWORD`） |
| `prisma/schema.prisma` | 資料庫 schema（已新增複合索引） |
