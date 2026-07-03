# 認證系統強化方案 - 方案 A 實作計畫 (auth_plan.md)

> 最後更新: 2026-01-09  
> 採用方案: **A - NextAuth 增強**

## 1. 方案概述

維持現有 NextAuth.js + Credentials Provider 架構，新增以下安全強化功能：

| 功能 | 說明 | 優先級 |
| :--- | :--- | :---: |
| 登入審計日誌 | 記錄所有登入嘗試 (成功/失敗) | P1 |
| 密碼複雜度策略 | 強制密碼符合複雜度要求 | P1 |
| 帳號鎖定機制 | 連續失敗後暫時鎖定 | P1 |

---

## 2. 詳細實作規劃

### 2.1 登入審計日誌 (Login Audit Log)

**目標**: 記錄所有登入嘗試，便於安全審計與異常偵測。

**資料庫結構**:

```prisma
model LoginLog {
  id        Int      @id @default(autoincrement())
  userId    String?  // 若登入成功則有值
  username  String   // 嘗試登入的帳號
  success   Boolean  // 是否成功
  ipAddress String?  // 來源 IP
  userAgent String?  // 瀏覽器資訊
  failReason String? // 失敗原因 (可選)
  createdAt DateTime @default(now())
  
  user User? @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([username])
  @@index([createdAt])
}
```

**修改檔案**:

- `prisma/schema.prisma`: 新增 LoginLog 模型
- `src/lib/auth.ts`: 在 authorize 中記錄登入結果
- `src/actions/audit.ts`: 新增審計相關 Server Actions
- `src/app/admin/audit/page.tsx`: 新增審計日誌檢視頁面

**API 設計**:

```typescript
// src/actions/audit.ts
export async function logLoginAttempt(data: {
  username: string;
  success: boolean;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  failReason?: string;
}) { ... }

export async function getLoginLogs(filters?: {
  userId?: string;
  success?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) { ... }
```

---

### 2.2 密碼複雜度策略 (Password Policy)

**目標**: 確保使用者密碼符合安全標準。

**策略規則**:

| 規則 | 要求 |
| :--- | :--- |
| 最小長度 | 8 字元 |
| 大寫字母 | 至少 1 個 |
| 小寫字母 | 至少 1 個 |
| 數字 | 至少 1 個 |
| 特殊字元 | 選用 (可設定) |

**修改檔案**:

- `src/lib/password-policy.ts`: 新增密碼驗證邏輯
- `src/actions/users.ts`: createUser / updateUser 加入驗證
- `src/app/admin/users/page.tsx`: 前端即時驗證提示

**實作範例**:

```typescript
// src/lib/password-policy.ts
export const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,
};

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`密碼長度至少 ${PASSWORD_POLICY.minLength} 字元`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('需包含至少一個大寫字母');
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('需包含至少一個小寫字母');
  }
  if (PASSWORD_POLICY.requireNumber && !/\d/.test(password)) {
    errors.push('需包含至少一個數字');
  }
  if (PASSWORD_POLICY.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('需包含至少一個特殊字元');
  }
  
  return { valid: errors.length === 0, errors };
}
```

---

### 2.3 帳號鎖定機制 (Account Lockout)

**目標**: 防止暴力破解攻擊。

**策略規則**:

| 規則 | 值 |
| :--- | :--- |
| 最大失敗次數 | 5 次 |
| 鎖定時間 | 15 分鐘 |
| 計數重置 | 成功登入後 |

**資料庫擴充**:

```prisma
model User {
  // ... existing fields
  failedLoginAttempts Int      @default(0)
  lockedUntil         DateTime?
}
```

**修改檔案**:

- `prisma/schema.prisma`: User 模型新增欄位
- `src/lib/auth.ts`: authorize 加入鎖定檢查邏輯
- `src/actions/users.ts`: 新增解鎖功能 (Admin)

**驗證流程**:

```text
1. 檢查帳號是否存在
2. 檢查是否被鎖定 (lockedUntil > now)
   ├─ 是 → 回傳「帳號已鎖定，請稍後再試」
   └─ 否 → 繼續
3. 驗證密碼
   ├─ 成功 → 重置 failedLoginAttempts，記錄登入
   └─ 失敗 → failedLoginAttempts++
              若 >= 5 → 設定 lockedUntil = now + 15min
```

---

## 3. 前端 UI 規劃

### 3.1 新增頁面

| 路由 | 說明 |
| :--- | :--- |
| `/admin/audit` | 登入審計日誌列表 |

### 3.2 現有頁面修改

| 頁面 | 修改項目 |
| :--- | :--- |
| `/admin/users` (Edit Modal) | 顯示密碼策略提示、解鎖按鈕 |
| `/auth/login` | 帳號鎖定錯誤訊息 |

---

## 4. 安全性考量

| 項目 | 措施 |
| :--- | :--- |
| 密碼傳輸 | 維持 HTTPS (已實作) |
| 暴力破解防護 | 帳號鎖定 + IP Rate Limiting (可擴充) |
| 審計日誌保留 | 建議保留 90 天以上 |

---

## 5. 測試計畫

| 測試項目 | 驗證內容 |
| :--- | :--- |
| 密碼策略 | 弱密碼應被拒絕 |
| 帳號鎖定 | 連續 5 次失敗後鎖定 15 分鐘 |
| 審計日誌 | 登入成功/失敗皆有記錄 |
| Admin 功能 | 可檢視日誌、解鎖帳號 |

---

## 6. 預估時程

| 項目 | 預估工時 |
| :--- | :--- |
| 登入審計日誌 | 4 小時 |
| 密碼複雜度策略 | 2 小時 |
| 帳號鎖定機制 | 3 小時 |
| 測試與修正 | 3 小時 |
| **合計** | **約 1.5 天** |
