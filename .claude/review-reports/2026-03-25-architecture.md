# LLRWD-RMS 跨層架構審查報告

**審查日期**: 2026-03-25
**審查範圍**: 審批流程完整性、fullId 端對端一致性、軟刪除跨層行為、型別同步、設計決策遵守

---

## 執行摘要

LLRWD-RMS 的跨層架構一致性整體良好。審批流程覆蓋完整，fullId 生成/cascade/顯示/連結端對端一致，軟刪除行為在 Prisma → Actions → UI 各層正確實施。主要問題在於 JWT session 與 DB 狀態可能不同步，以及部分 findMany 查詢在 export 時未過濾 isDeleted。

**發現**: 0 Critical、1 High、3 Medium、2 Low

**整體評級**: 4.5/5 — 架構設計優良

---

## 1. 審批流程完整性

### ChangeRequest 流程: 完整

```
Editor 提交 → ChangeRequest(PENDING)
  → Inspector/Admin 審核 → APPROVED → 執行變更
  → Inspector/Admin 拒絕 → REJECTED
  → Editor 撤回 → CANCELLED
  → 拒絕後重新提交 → 新 ChangeRequest(previousRequestId 指向原始)
```

### QC Document 流程: 完整

```
ChangeRequest APPROVED → 自動建立 QCDocumentApproval(PENDING_QC)
  → QC 人員核准 → QC_APPROVED(PENDING_PM)
  → PM 人員核准 → PM_APPROVED → 生成 PDF
  → QC/PM 拒絕 → REJECTED → 可修訂重送
  → QC 要求修訂 → REVISION_REQUESTED(iteration++)
```

### 正面發現
- 狀態轉換邊界清晰，無非法轉換路徑
- `previousRequestId` 鏈正確維護拒絕/重送歷史
- PDF 生成僅在 PM_APPROVED 時觸發

---

## 2. fullId 端對端一致性

### 生成層: `src/lib/item-utils.ts`
- 基於 project.codePrefix + 階層位置自動生成
- 正確處理 multi-segment prefix（如 `RMS-DAREN-4-1`）

### Cascade 層: `src/actions/item-reorder.ts`
- `collectDescendantChanges()` → `batchCascadeFullIdChanges()` 兩階段正確
- `__TEMP_` 前綴避免唯一約束衝突
- `__DELETED_` 前綴處理 soft-deleted items 的 fullId 佔位

### 顯示層: UI components
- 所有 UI 元件正確顯示 fullId
- `SidebarNav` 和 `ItemTree` 正確使用 fullId 排序

### 連結層: Tiptap ItemLink
- `ITEM_ID_CORE_PATTERN` 從 `itemLinkPlugin.ts` export，`ItemLink.ts` import
- Regex `(?:[A-Z]+-)+\d+(?:-\d+)*` 正確匹配 multi-segment prefix
- 無同步風險

---

## 3. 軟刪除行為跨層一致

### Prisma Schema
- `Item.isDeleted` Boolean default false
- `DataFile.isDeleted` Boolean default false
- 無 DB 層 soft-delete middleware（手動管理）

### Server Actions 層
- `item.findMany` 查詢：9 處中 8 處正確加入 `isDeleted: false`
- `dataFile.findMany` 查詢：全部正確過濾
- **例外**: `export-service.ts` L199 未過濾 isDeleted（匯出全部，見 B-2）

### UI 層
- 列表頁面：全部正確過濾
- 詳情頁面：顯示「已刪除」badge
- Sidebar：正確排除已刪除 items

### [Medium] A-1: export-service 匯出包含 soft-deleted items

**位置**: `src/lib/backup/export-service.ts` L199
**問題**: 跨層不一致 — UI 層過濾了 soft-deleted，但 export 不過濾，匯入後可能造成困惑。
**建議**: 與 B-2 相同，提供選項或預設過濾。

---

## 4. JWT Session 與 DB 狀態同步

### [High] A-2: JWT 中的角色/資格可能與 DB 不同步

**位置**: `src/lib/auth.ts` L178-186
**問題**:
- `role`、`isPM`、`isQC` 在登入時寫入 JWT，直到 token 過期才更新
- Admin 修改使用者角色後，舊 session 仍有舊角色
- `qc-approval.ts` 正確使用 `getUserQualifications()` 從 DB 驗證 isPM/isQC
- 但 `approval.ts` 的 `canReview()` 直接使用 `session.user.role`（L872）

**影響**: 如果 Admin 將 Inspector 降級為 Viewer，該使用者在 session 過期前仍可審核

**修復建議**:
1. 短期：在關鍵操作（審核、刪除）中從 DB 重新查詢使用者角色
2. 中期：縮短 JWT maxAge 或實作 token rotation
3. 長期：在 jwt callback 中加入 DB 查詢（需注意效能）

---

## 5. Prisma Schema 與 TypeScript 型別同步

### 正面發現
- `src/types/next-auth.d.ts` 正確擴展 Session 和 JWT 型別
- Prisma Client 自動生成的型別與 schema 同步
- Server Actions 的 return type 使用明確的 interface

### [Medium] A-3: Server Action return types 未統一定義

**問題**: 部分 action 使用 ad-hoc return type，部分使用 `{ success: boolean; error?: string; data?: T }`。
**建議**: 定義 `ActionResult<T>` 泛型型別，統一所有 Server Actions 的 return type。

---

## 6. 設計決策遵守狀況

### CLAUDE.md 規範檢查

| 規範 | 遵守狀況 |
|------|----------|
| 所有 UI 文字使用繁體中文 | ✅ 正確 |
| changeType 標籤使用中文 | ✅ 正確 |
| Server Actions 返回 `{ success, error?, data? }` | ⚠️ 部分使用 throw |
| HTML sanitize 使用 isomorphic-dompurify | ✅ 正確 |
| MIME type 白名單驗證 | ✅ 正確 |
| 軟刪除使用 isDeleted flag | ✅ 正確 |
| 多步驟 DB 操作使用 $transaction | ✅ 正確（13 處） |
| ITEM_ID_CORE_PATTERN 使用共享常數 | ✅ 正確 |
| fullId regex 支援 multi-segment prefix | ✅ 正確 |

### [Medium] A-4: revalidatePath 拼寫不一致

**問題**: `approval.ts` 中混用 `/admin/approval` 和 `/admin/approvals`，可能有一個是錯誤的。
**建議**: 確認實際路由路徑並統一。

---

## 7. 資料流一致性

### [Low] A-5: Notification link 驗證位於 client 端

**問題**: Open redirect 防護（`/^\/[^/]/`）應同時在 server 端建立 notification 時驗證。
**建議**: 在 `createNotification()` 中也加入 link 格式驗證。

### [Low] A-6: ItemHistory JSON snapshot 無 schema 版本控制

**問題**: `ItemHistory.snapshot` 存的 JSON 結構可能隨 schema 變更而不相容。
**建議**: 在 snapshot 中加入 `_schemaVersion` 欄位。

---

## 架構一致性整體評估

### 優勢
- 審批流程端對端完整，無漏洞
- fullId 從生成到顯示到連結完全一致
- 軟刪除在所有層正確實施（1 個例外）
- CLAUDE.md 設計決策大部分被遵守

### 需改進
- JWT session 與 DB 角色同步（High）
- export soft-delete 過濾（Medium）
- Server Action return type 統一（Medium）
- revalidatePath 路徑正確性（Medium）

### 風險統計
- **Critical:** 0
- **High:** 1
- **Medium:** 3
- **Low:** 2
