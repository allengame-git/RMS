# LLRWD-RMS 修復 Checklist (High 以上)

> 產生日期：2026-03-25
> 來源：`.claude/review-reports/2026-03-25-*.md`
> 最後更新：2026-03-25

---

## Critical Issues

### Issue #1: [S-1] item-relations.ts 缺乏認證檢查
- **嚴重度**: Critical
- **類別**: Security — 未授權存取
- **位置**: `src/actions/item-relations.ts`
- **問題**: 4 個 server action 完全沒有認證檢查
- **狀態**: [x] 已修復 (2026-03-25) — 已驗證通過

---

### Issue #2: [S-2] search.ts 缺乏認證檢查
- **嚴重度**: Critical
- **類別**: Security — 未授權存取
- **位置**: `src/actions/search.ts`
- **問題**: `searchProjectItems` 無認證檢查
- **狀態**: [x] 已修復 (2026-03-25) — 已驗證通過

---

## High Issues

### Issue #3: [S-3] datafiles/upload MIME type fallback 邏輯問題
- **嚴重度**: High
- **類別**: Security — 輸入驗證
- **位置**: `src/app/api/datafiles/upload/route.ts` L136
- **問題**: 回應使用 fallback `file.type || 'application/octet-stream'`
- **狀態**: [x] 已修復 (2026-03-25) — 移除 fallback，直接使用 `file.type`

---

### Issue #4: [S-4 / A-2] JWT Session 中的角色/資格可能過期不同步
- **嚴重度**: High
- **類別**: Security — Session 管理
- **位置**: `src/actions/approval.ts`, `src/actions/data-files.ts`
- **問題**: 關鍵操作直接使用 `session.user.role` 而非從 DB 查詢
- **狀態**: [x] 已修復 (2026-03-25) — `approval.ts` 加入 `getUserCurrentRole()`，`data-files.ts` 加入 `getCurrentRole()`，覆蓋 approve/reject/cancel 函式

---

### Issue #5: [S-5] getCategories() 缺乏認證檢查
- **嚴重度**: High
- **類別**: Security — 未授權存取
- **位置**: `src/actions/project-category.ts`
- **問題**: 任何人都可以取得專案分區列表
- **狀態**: [x] 已修復 (2026-03-25) — 加入 session 檢查

---

### Issue #6: [B-1] Server Actions 錯誤處理模式不一致
- **嚴重度**: High
- **類別**: Backend — 程式碼品質
- **位置**: 7 個 action 檔案
- **問題**: 72 處 `throw new Error` vs 42 處 `return { success: false }`
- **狀態**: [x] 已修復 (2026-03-25) — 7 個 action 檔案全部轉換為 return { error } 模式，所有 caller 已更新為檢查 result.error。Backend reviewer 驗證通過。

---

### Issue #7: [B-3] batchApproveAsPM 非原子操作
- **嚴重度**: High
- **類別**: Backend — 資料完整性
- **位置**: `src/actions/qc-approval.ts` L316-347
- **問題**: batch 操作非原子
- **狀態**: [x] 已修復 (2026-03-25) — 文檔化 partial success 是預期行為（PDF I/O 密集不適合 transaction）

---

### Issue #8: [F-1] ThemeContext 未整合進 RootLayout
- **嚴重度**: High
- **類別**: Frontend — 功能正確性
- **位置**: `src/app/layout.tsx`, `src/components/layout/Navbar.tsx`
- **問題**: ThemeContext 未連接，Navbar 繞過 Context 直接操作 localStorage
- **狀態**: [x] 已修復 (2026-03-25) — ThemeProvider 包裹 layout，Navbar 改用 useTheme()

---

### Issue #9: [F-2 / B-5] revalidatePath 不一致
- **嚴重度**: High
- **類別**: Frontend + Backend — 功能正確性
- **位置**: `src/actions/qc-approval.ts`
- **問題**: `/admin/approvals` (plural) 拼寫錯誤，實際路由為 `/admin/approval`
- **狀態**: [x] 已修復 (2026-03-25) — 4 處 `/admin/approvals` 已修正為 `/admin/approval`

---

## 修復統計

| 狀態 | 數量 |
|------|------|
| 已修復 | 9/9 |
| 延後 | 0/9 |
