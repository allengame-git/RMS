# LLRWD-RMS Code Review 整合報告

**審查日期**: 2026-03-25
**審查範圍**: 安全、後端品質、前端品質、跨層架構
**個別報告**: `2026-03-25-security.md`, `2026-03-25-backend.md`, `2026-03-25-frontend.md`, `2026-03-25-architecture.md`

---

## 整體 Codebase 健康度評估

| 維度 | 評分 | 說明 |
|------|------|------|
| 安全性 | 78/100 | 核心防護完善，但有 2 個 Critical 認證缺失 |
| 後端品質 | 80/100 | fullId cascade 和審批 pipeline 正確，錯誤處理需統一 |
| 前端品質 | 82/100 | RSC 正確使用，Tiptap 設計優良，主題系統未啟用 |
| 架構一致性 | 88/100 | 跨層行為一致，設計決策遵守良好 |
| **綜合** | **82/100** | **生產可用，需優先修復 Critical 安全問題** |

---

## Critical 和 High 問題彙整

### Critical (2)

| ID | 類別 | 問題 | 位置 |
|----|------|------|------|
| S-1 | 安全 | `item-relations.ts` 4 個 action 完全無認證檢查 | `src/actions/item-relations.ts` |
| S-2 | 安全 | `searchProjectItems()` 無認證檢查，可洩漏專案資訊 | `src/actions/search.ts` |

### High (6)

| ID | 類別 | 問題 | 位置 |
|----|------|------|------|
| S-3 | 安全 | datafiles/upload MIME type fallback 邏輯問題 | `src/app/api/datafiles/upload/route.ts` |
| S-4 | 安全 | JWT 中 isPM/isQC flag 可能過期不同步 | `src/lib/auth.ts` |
| S-5 | 安全 | `getCategories()` 缺乏認證檢查 | `src/actions/project-category.ts` |
| B-1 | 後端 | Server Actions 錯誤處理模式不一致 (72x throw vs 42x return) | 7 個 action 檔案 |
| B-3 | 後端 | `batchApproveAsPM` 非原子操作 | `src/actions/qc-approval.ts` |
| F-1 | 前端 | ThemeContext 未整合進 RootLayout | `src/app/layout.tsx` |

---

## 修復優先順序 (Top 10)

| 優先序 | ID | 嚴重度 | 修復內容 | 預估工時 |
|--------|-----|--------|----------|----------|
| **1** | S-1 | Critical | `item-relations.ts` 加入 session 認證和角色檢查 | 30 min |
| **2** | S-2 | Critical | `search.ts` 加入 session 認證檢查 | 15 min |
| **3** | S-5 | High | `project-category.ts` 的 `getCategories()` 加入認證 | 15 min |
| **4** | S-4/A-2 | High | 關鍵操作（審核、刪除）從 DB 重新查詢使用者角色/資格 | 2 hr |
| **5** | B-1 | High | 統一 Server Actions 錯誤處理為 `return { success: false }` 模式 | 3 hr |
| **6** | S-3 | High | 移除 upload route 的 MIME type fallback | 15 min |
| **7** | S-6 | Medium | 帳號鎖定改用 Prisma atomic increment | 30 min |
| **8** | B-5/F-7/A-4 | Medium | 統一 revalidatePath 策略，修正拼寫不一致 | 1 hr |
| **9** | S-7 | Medium | 備份匯出排除密碼雜湊欄位 | 30 min |
| **10** | F-1 | High | 整合 ThemeProvider 進 RootLayout | 1 hr |

---

## 各報告問題統計

| 報告 | Critical | High | Medium | Low | 合計 |
|------|----------|------|--------|-----|------|
| 安全 | 2 | 3 | 5 | 3 | 13 |
| 後端 | 0 | 2 | 4 | 2 | 8 |
| 前端 | 0 | 2 | 5 | 3 | 10 |
| 架構 | 0 | 1 | 3 | 2 | 6 |
| **合計（去重後）** | **2** | **6** | **12** | **7** | **27** |

> 注：S-4 與 A-2、B-5 與 F-7 與 A-4 為跨報告重複問題，已去重。

---

## 正面發現摘要

以下是 codebase 中做得特別好的部分：

1. **fullId cascade 兩階段重命名** — `__TEMP_` 前綴 + transaction 完全正確
2. **自我審批防護** — approval.ts 和 data-files.ts 正確阻擋
3. **Zip Slip / Open Redirect / XSS 防護** — 全部正確實作
4. **Tiptap ITEM_ID_CORE_PATTERN** — 共享常數，無同步風險
5. **RSC 邊界** — 'use client' 使用合理，無誤用
6. **軟刪除跨層一致** — Prisma → Actions → UI 全部正確過濾
7. **SQL 白名單驗證** — restore 路由正確限制可執行的 SQL
8. **DOMPurify sanitization** — 所有 HTML 渲染皆有防護

---

## 建議行動計劃

### Phase 1: 緊急修復 (本週)
- [ ] 修復 2 個 Critical 認證缺失 (S-1, S-2)
- [ ] 修復 getCategories 認證 (S-5)
- [ ] 移除 MIME fallback (S-3)

### Phase 2: 安全加固 (下週)
- [ ] 關鍵操作 DB 角色驗證 (S-4/A-2)
- [ ] 帳號鎖定 atomic increment (S-6)
- [ ] 備份排除密碼 (S-7)

### Phase 3: 品質統一 (2 週內)
- [ ] Server Actions 錯誤處理統一 (B-1)
- [ ] revalidatePath 策略統一 (B-5/F-7)
- [ ] ThemeProvider 整合 (F-1)

### Phase 4: 技術債清理 (1 個月內)
- [ ] Suspense/Streaming 優化 (F-3)
- [ ] Modal 元件抽象 (F-10)
- [ ] 表單模式統一 useActionState (F-9)
- [ ] LoginLog 清理機制 (S-10)
