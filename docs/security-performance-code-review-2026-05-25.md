# LLRWD-RMS 資安與效能 Code Review 報告

日期：2026-05-25

範圍：本次審查聚焦資訊安全漏洞、權限邊界、檔案處理、備份還原、資料庫查詢與主要頁面效能。未執行滲透測試，也未連線正式資料庫量測查詢計畫。

## 摘要

系統已具備基本認證、角色授權、上傳 MIME 白名單、Zip Slip 防護、通知 open redirect 防護，以及危險還原 API 的 ADMIN 權限檢查。最需要立刻修補的是資料檔上傳 API 中未驗證的 `dataYear` 路徑片段，非 VIEWER 使用者可藉由 `../` 讓檔案寫入預期目錄外。

效能方面，主要風險集中在全量載入樹狀資料、無分頁的審核/資料檔/歷史列表、`contains` 模糊搜尋，以及備份還原與下載代理將大檔一次載入記憶體。這些問題會隨資料量成長而變成明顯延遲或記憶體壓力。

## 馬上修復

### SEC-01 資料檔上傳可路徑穿越寫入預期目錄外

位置：`src/app/api/datafiles/upload/route.ts:80`, `src/app/api/datafiles/upload/route.ts:118`

`dataYear` 直接取自 `formData`，再放入 `path.join(process.cwd(), 'public', 'uploads', 'datafiles', dataYear, userId, subDir)`。目前只檢查是否存在，沒有驗證它是 4 位數年份，也沒有在寫入前做 `path.resolve` 邊界檢查。Node 的 `path.join` 會解析 `..`，因此 `dataYear=../../../../tmp` 會把目標目錄導到 `/tmp/...`。

影響：任何已登入且非 VIEWER 的使用者可把檔案寫到 `public/uploads/datafiles` 外。雖然檔名是 UUID，攻擊者仍可造成任意目錄落檔、磁碟污染，並配合可接受 MIME 與副檔名缺乏一致檢查擴大風險。

建議：

- 僅接受整數年份，例如 `/^\d{4}$/`，並限制合理範圍。
- 建立 `baseDir = path.resolve(process.cwd(), 'public', 'uploads', 'datafiles')`，寫入前確認 `resolvedTarget.startsWith(baseDir + path.sep)`。
- 將 MIME 白名單與副檔名白名單綁定檢查，拒絕 `text/plain` 搭配 `.html`、`.js` 這類不預期副檔名。
- 對 `file.name` 的副檔名做小寫正規化，只允許業務需要的副檔名。

## 建議修復

### SEC-02 上傳 API 信任瀏覽器提供的 MIME type

位置：`src/app/api/upload/route.ts:77`, `src/app/api/datafiles/upload/route.ts:98`

兩個上傳 API 都以 `file.type` 判斷檔案類型，但 `file.type` 由客戶端提供，不等同檔案內容。一般上傳還允許 `text/plain`、`text/csv`，但副檔名完全沿用原檔名副檔名。

建議：加入 magic number / 檔頭檢查，至少對 PDF、Office、圖片、ZIP 類型做內容驗證；並建立 MIME 與副檔名對照表。

### SEC-03 預設管理員帳密寫死且文件鼓勵部署後使用

位置：`scripts/seed-admin.ts:7`, `scripts/seed-admin.ts:8`, `README.md:229`, `README.md:245`

Seeder 固定建立 `admin/adminpassword`。README 也明列預設帳密。若部署流程沒有強制改密碼，這是常見入侵入口。

建議：讓 seed 從環境變數讀取初始密碼；未設定強密碼時拒絕 seed。首次登入強制改密碼，並在部署文件中移除固定密碼或標成僅限本機測試。

### SEC-04 缺少集中式安全標頭

位置：`next.config.mjs:1`

目前沒有看到 `Content-Security-Policy`、`X-Frame-Options` / `frame-ancestors`、`X-Content-Type-Options`、`Referrer-Policy` 等全站安全標頭。Rich text 與附件下載功能越多，CSP 越重要。

建議：在 `next.config.mjs` 的 `headers()` 設定基本安全標頭。CSP 可先採保守版本，至少限制 `script-src 'self'`、`object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`。

### PERF-01 專案頁與項目頁全量載入樹狀資料

位置：`src/app/projects/[id]/page.tsx:20`, `src/app/projects/[id]/page.tsx:23`, `src/app/items/[id]/layout.tsx:26`

專案頁用 `include.items` 載入整個專案所有未刪除 Item，且沒有 `select`，會把 `content`、`attachments` 等大欄位一併抓回來。項目頁 layout 也會為側欄每次載入同專案全部 Item。

建議：專案樹與側欄只選 `id/fullId/title/parentId/projectId`。若專案 Item 數可能上千，加入懶載入、分層展開或虛擬化。

### PERF-02 多個清單無分頁，資料成長後會拖慢審核與歷史頁

位置：`src/actions/approval.ts:428`, `src/actions/data-files.ts:63`, `src/actions/data-files.ts:136`, `src/actions/qc-approval.ts:97`, `src/actions/qc-approval.ts:114`, `src/actions/history.ts:288`

審核、資料檔、QC/PM 簽核、歷史清單多處 `findMany` 沒有 `take/skip` 或 cursor。部分查詢還包含 content、relations、references 等較重關聯。

建議：所有列表 API 改為分頁或 cursor-based pagination；列表頁只取摘要欄位，詳情頁再取完整內容。

### PERF-03 `contains` 模糊搜尋難以使用一般索引

位置：`src/actions/search.ts:61`, `src/app/api/items/search/route.ts:39`, `src/actions/data-files.ts:136`

多處使用 `contains` 搜尋 title/content/description。PostgreSQL 在 `%term%` 類查詢上通常會掃描大量資料。`searchProjectItems` 還先 `take: 50` 再去 HTML tag，可能漏掉後續真正匹配的項目。

建議：導入 PostgreSQL full-text search 或 `pg_trgm` GIN index；先把 rich text 的純文字版本另存欄位，用資料庫層搜尋與排序。

## 後續再修復

### PERF-04 檔案下載與還原以整檔 buffer 處理，容易造成記憶體尖峰

位置：`src/app/uploads/[...path]/route.ts:79`, `src/app/iso_doc/[filename]/route.ts:44`, `src/app/api/admin/restore/uploads/route.ts:39`, `src/app/api/admin/restore/uploads/route.ts:88`, `src/app/api/admin/restore/iso-docs/route.ts:38`, `src/app/api/admin/restore/iso-docs/route.ts:91`

下載代理與還原流程多處用 `readFile()`、`file.arrayBuffer()`、`entry.buffer()`。100MB 上傳或大型備份會造成短時間高記憶體使用。還原 API 是 ADMIN-only，風險主要是可用性。

建議：下載改用 stream response；還原 ZIP 改成 entry stream 到檔案，並加入備份檔大小、單檔大小、檔案數量與總解壓大小上限。

### SEC-05 登入失敗次數更新不是原子操作

位置：`src/lib/auth.ts:113`, `src/lib/auth.ts:124`

登入流程先讀取使用者，再以讀到的 `failedLoginAttempts` 計算新值。大量並行錯誤登入可能造成計數覆蓋，降低鎖定精準度。

建議：用資料庫原子 increment，或在交易中以條件更新鎖定狀態。若系統面向內網，這可排在第二波修補。

### PERF-05 Schema 缺少部分常用查詢組合索引

位置：`prisma/schema.prisma:85`, `prisma/schema.prisma:154`, `prisma/schema.prisma:239`, `prisma/schema.prisma:329`

目前有部分 FK 與歷史索引，但常見查詢會依 `projectId + isDeleted + fullId`、`status + createdAt`、`dataYear + isDeleted + createdAt` 過濾排序。這些組合索引尚未明確定義。

建議：依實際查詢計畫新增複合索引，例如 Item `(projectId, isDeleted, fullId)`、ChangeRequest `(status, createdAt)`、QCDocumentApproval `(status, createdAt)`、DataFile `(isDeleted, dataYear, createdAt)`。

## 優先修復順序

1. 修補 `dataYear` 路徑穿越，補測試覆蓋 `../`、絕對路徑、非年份字串。
2. 加強上傳副檔名與 MIME/檔頭一致性檢查。
3. 移除固定 seed 密碼，建立首次改密碼流程。
4. 專案頁與項目側欄改成窄欄位 `select`。
5. 審核、資料檔、歷史清單加分頁。
6. 搜尋改用全文索引或 trigram。
7. 檔案下載/還原改串流並加資源上限。
8. 補安全標頭與登入鎖定原子更新。
