# 單元測試計畫：系統備份與復原功能

## 1. 測試目標

確保備份與復原的核心邏輯（字串轉義、SQL 生成、Manifest 產生）正確無誤，並且能正確處理各種邊界情況。

## 2. 測試框架

- **Framework**: Jest 或 Vitest (依專案現有設定，推薦 Vitest 因其速度快且相容 Jest)
- **Mocking**: `vi.mock` (Vitest) 或 `jest.mock` (Jest) 用於模擬 Prisma Client

## 3. 測試範圍與案例詳情

### 3.1 核心工具函式 (Utility Functions)

這些函式目前未匯出，需暫時 export 以供測試，或透過 `rewire` 測試。建議修改 `src/lib/backup-utils.ts` 將其匯出。

#### `escapeValue(value: unknown): string`

- **案例 1: Null/Undefined**
  - Input: `null` / `undefined`
  - Output: `'NULL'`
- **案例 2: Boolean**
  - Input: `true`, `false`
  - Output: `'TRUE'`, `'FALSE'`
- **案例 3: Number**
  - Input: `123`, `123.45`
  - Output: `'123'`, `'123.45'`
- **案例 4: String (一般)**
  - Input: `'Hello'`
  - Output: `'Hello'`
- **案例 5: String (特殊字元轉義)**
  - Input: `'O'Connor'`
  - Output: `'O''Connor'` (SQL 單引號轉義)
- **案例 6: Date**
  - Input: `new Date('2026-01-01T00:00:00Z')`
  - Output: `'2026-01-01T00:00:00.000Z'`
- **案例 7: Object/Array**
  - Input: `{ key: 'value' }`, `[1, 2]`
  - Output: JSON string with escaped quotes

#### `toSnakeCase(str: string): string`

- **案例 1: CamelCase**
  - Input: `'itemCode'`
  - Output: `'item_code'`
- **案例 2: PascalCase**
  - Input: `'ItemRelation'`
  - Output: `'item_relation'`

#### `generateInsertStatements(tableName: string, records: any[]): string`

- **案例 1: 空陣列**
  - Input: `'User'`, `[]`
  - Output: `''` (空字串)
- **案例 2: 單筆資料**
  - Input: `'User'`, `[{ id: 1, name: 'Test' }]`
  - Output: 包含 `DELETE FROM "User";` 和 `INSERT INTO "User" ("id", "name") VALUES (1, 'Test');`
- **案例 3: 資料包含特殊字元**
  - Input: `'User'`, `[{ name: "O'Neil" }]`
  - Output: Value 應為 `'O''Neil'`

### 3.2 導出功能 (Export Functions)

#### `generateFileManifest(backupType, fileCount, totalSize)`

- **案例 1: 正常輸入**
  - Input: `'uploads'`, `10`, `1024`
  - Output: Object 包含正確的 `version`, `stats` (MB計算正確), `backupType`

#### `generateDatabaseManifest()`

- **Mock 需求**: `prisma.$queryRaw` 或 `prisma.model.count()`
- **案例 1: 正常統計**
  - Mock: 各 Table count 返回固定數值
  - Output: Object 包含正確的 `stats` 對應各表數量
- **案例 2: 資料庫錯誤**
  - Mock: Prisma 拋出錯誤
  - Output: 該表 count 為 0，不應 crash

#### `exportDatabaseToSQL()`

- **Mock 需求**: Mock `prisma.model.findMany()`
- **案例 1: 完整流程**
  - Mock: 模擬兩個 Table (`User`, `Project`) 的回傳資料
  - Output: 檢查產生的 SQL 字串是否包含：
    1. Header 資訊
    2. TRANSACTION (`BEGIN`, `COMMIT`)
    3. DELETE 語句 (逆序)
    4. INSERT 語句 (正序)

### 3.3 導入功能 (Import Functions)

#### `importDatabaseFromSQL(sql: string)`

- **Mock 需求**: `prisma.$executeRawUnsafe`
- **案例 1: 成功執行**
  - Mock: Resolve 成功
  - Output: `{ success: true }`
- **案例 2: 執行失敗**
  - Mock: Reject with error
  - Output: `{ success: false, error: ... }`

#### `forceLogoutAllUsers()`

- **Mock 需求**: `prisma.user.updateMany`
- **案例 1: 執行登出**
  - 驗證 `updateMany` 是否被呼叫，且包含 `updatedAt` 更新

## 4. SQL 驗證邏輯測試 (新增)

針對 `/src/app/api/admin/restore/database/route.ts` 中的驗證邏輯：

- **案例 1: 空 SQL**
  - Input: `''`
  - Expected: Error '無效的備份檔案：SQL 檔案中沒有任何資料'
- **案例 2: 缺少使用者資料**
  - Input: `INSERT INTO "Project" ...` (無 User insert)
  - Expected: Error '無效的備份檔案：沒有使用者資料'
- **案例 3: 缺少管理員資料**
  - Input: `INSERT INTO "User" ...` (無 ADMIN role)
  - Expected: Error '無效的備份檔案：沒有管理員帳號'
- **案例 4: 驗證通過**
  - Input: 包含 `INSERT INTO "User"` 且 value 包含 `ADMIN`
  - Expected: Pass
