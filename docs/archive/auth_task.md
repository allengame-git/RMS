# 認證系統強化 - 工作項目追蹤 (auth_task.md)

> 最後更新: 2026-01-09  
> 採用方案: A - NextAuth 增強
> 狀態: ✅ 完成

## Phase 1: 登入審計日誌

### 1.1 資料庫擴充

- [x] `prisma/schema.prisma`: 新增 `LoginLog` 模型
- [x] 執行 `prisma db push` 更新資料庫
- [x] 執行 `prisma generate` 更新 Client

### 1.2 後端實作

- [x] 建立 `src/actions/audit.ts`
  - [x] `logLoginAttempt()`: 記錄登入嘗試
  - [x] `getLoginLogs()`: 查詢登入日誌 (支援篩選)
  - [x] `getLoginStats()`: 取得統計資訊
- [x] 修改 `src/lib/auth.ts`
  - [x] 在 `authorize` 成功時記錄登入
  - [x] 在 `authorize` 失敗時記錄登入
  - [x] 記錄 IP 與 User-Agent

### 1.3 前端 UI

- [x] 建立 `/admin/audit/page.tsx` - 審計日誌列表頁
  - [x] 表格顯示：時間、使用者、成功/失敗、IP、瀏覽器
  - [x] 統計卡片：登入次數、成功/失敗數、成功率

---

## Phase 2: 密碼複雜度策略

### 2.1 後端實作

- [x] 建立 `src/lib/password-policy.ts`
  - [x] 定義 `PASSWORD_POLICY` 常數
  - [x] 實作 `validatePassword()` 函式
  - [x] 實作 `getPasswordRequirements()` 函式
- [x] 修改 `src/actions/users.ts`
  - [x] `createUser` 加入密碼驗證
  - [x] `updateUser` 加入密碼驗證 (若有修改)
  - [x] 回傳友善錯誤訊息 (中文)

### 2.2 前端 UI

- [x] 建立 `src/components/auth/PasswordStrengthIndicator.tsx`
  - [x] 密碼強度進度條
  - [x] 各項規則符合狀態 (✓/○)
  - [x] 強度標籤 (強/中/弱/非常弱)
- [x] 修改 `/admin/users` Edit Modal
  - [x] 即時密碼強度提示 (Client-side)
  - [x] 顯示各項規則是否符合

---

## Phase 3: 帳號鎖定機制

### 3.1 資料庫擴充

- [x] `prisma/schema.prisma`: User 新增欄位
  - [x] `failedLoginAttempts Int @default(0)`
  - [x] `lockedUntil DateTime?`
- [x] 執行 `prisma db push`
- [x] 執行 `prisma generate`

### 3.2 後端實作

- [x] 修改 `src/lib/auth.ts`
  - [x] 登入前檢查 `lockedUntil`
  - [x] 登入失敗時 `failedLoginAttempts++`
  - [x] 達到 5 次時設定 `lockedUntil`
  - [x] 登入成功時重置計數
- [x] 修改 `src/actions/users.ts`
  - [x] 新增 `unlockUser()` 函式 (Admin 用)
  - [x] 新增 `getUsersWithLockStatus()` 函式

### 3.3 前端 UI

- [x] 修改 `/auth/login`
  - [x] 顯示「帳號已鎖定」錯誤訊息
  - [x] 中文化錯誤訊息
- [x] 修改 `/admin/users`
  - [x] 新增「狀態」欄位 (正常/已鎖定/失敗次數)
  - [x] 新增「解鎖」按鈕
  - [x] 鎖定帳號列高亮顯示

---

## Phase 4: 測試與文件

### 4.1 文件更新

- [x] 更新 `docs/tech.md` - 新增 Phase 13 認證系統技術說明
- [x] 更新 `README.md` - 新增安全功能說明

---

## 進度總覽

| Phase | 說明 | 狀態 |
| :--- | :--- | :---: |
| Phase 1 | 登入審計日誌 | ✅ 完成 |
| Phase 2 | 密碼複雜度策略 | ✅ 完成 |
| Phase 3 | 帳號鎖定機制 | ✅ 完成 |
| Phase 4 | 測試與文件 | ✅ 完成 |

---

## 已完成項目總覽

### 資料庫

- `LoginLog` 模型 (新增)
- User 新增 `failedLoginAttempts`, `lockedUntil`, `loginLogs` 關聯

### 後端檔案

| 檔案 | 狀態 | 說明 |
| :--- | :---: | :--- |
| `src/actions/audit.ts` | NEW | 登入審計 Server Actions |
| `src/lib/password-policy.ts` | NEW | 密碼策略驗證 |
| `src/lib/auth.ts` | MOD | 登入審計 + 帳號鎖定 |
| `src/actions/users.ts` | MOD | 密碼驗證 + 解鎖功能 |

### 前端頁面

| 檔案 | 狀態 | 說明 |
| :--- | :---: | :--- |
| `src/app/admin/audit/page.tsx` | NEW | 審計日誌頁面 |
| `src/app/admin/users/page.tsx` | MOD | 狀態欄位 + 解鎖按鈕 + 密碼強度 |
| `src/components/auth/LoginForm.tsx` | MOD | 帳號鎖定錯誤訊息 |
| `src/components/auth/PasswordStrengthIndicator.tsx` | NEW | 密碼強度指示器 |

### 文件

| 檔案 | 狀態 | 說明 |
| :--- | :---: | :--- |
| `docs/tech.md` | MOD | 新增 Phase 13 認證強化章節 |
| `README.md` | MOD | 新增安全功能說明 |
| `docs/auth_task.md` | NEW | 本工作追蹤文件 |
| `docs/auth_plan.md` | NEW | 認證強化規劃文件 |
