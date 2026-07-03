# 系統備份與復原功能 - 開發任務清單

> 最後更新: 2026-01-12

## 進度總覽

| Phase | 說明 | 狀態 |
|-------|------|------|
| Phase 1 | 備份功能 - 後端 API | ✅ 完成 |
| Phase 2 | 備份功能 - 前端 UI | ✅ 完成 |
| Phase 3 | 復原功能 - 後端 API | ✅ 完成 |
| Phase 4 | 復原功能 - 前端 UI | ✅ 完成 |
| Phase 5 | 整合測試與文件 | ⏳ 進行中 |

---

## Phase 1: 備份功能 - 後端 API

### 1.1 基礎建設

- [ ] 安裝依賴套件 (`archiver`, `@types/archiver`)
- [ ] 建立 `src/lib/backup-utils.ts` 工具函式

### 1.2 資料庫備份 API

- [ ] 建立 `src/app/api/admin/backup/database/route.ts`
- [ ] 實作 Prisma 資料匯出邏輯 (所有 Tables)
- [ ] 實作 SQL INSERT 語句生成
- [ ] 建立 manifest.json 結構
- [ ] 實作 ZIP 壓縮與下載串流

### 1.3 上傳檔案備份 API

- [ ] 建立 `src/app/api/admin/backup/uploads/route.ts`
- [ ] 實作 `/public/uploads/` 目錄壓縮
- [ ] 建立 manifest.json 結構
- [ ] 實作 ZIP 壓縮與下載串流

### 1.4 ISO 文件備份 API

- [ ] 建立 `src/app/api/admin/backup/iso-docs/route.ts`
- [ ] 實作 `/public/iso_doc/` 目錄壓縮
- [ ] 建立 manifest.json 結構
- [ ] 實作 ZIP 壓縮與下載串流

---

## Phase 2: 備份功能 - 前端 UI

### 2.1 備份區塊元件

- [ ] 建立 `src/components/admin/BackupRestoreSection.tsx`
- [ ] 實作備份區塊 UI (三個下載按鈕)
- [ ] 實作「全部下載」功能 (依序下載)
- [ ] 實作下載進度顯示
- [ ] 實作錯誤處理與提示

### 2.2 整合至使用者管理頁面

- [ ] 修改 `/admin/users/page.tsx` 引入備份區塊
- [ ] 確認權限檢查 (僅 ADMIN 可見)

---

## Phase 3: 復原功能 - 後端 API

### 3.1 資料庫復原 API

- [ ] 建立 `src/app/api/admin/restore/database/route.ts`
- [ ] 實作 ZIP 解壓縮邏輯
- [ ] 實作 manifest.json 驗證
- [ ] 實作 SQL 匯入邏輯 (清空 + 重建)
- [ ] **實作強制登出所有使用者** (清除 Session)
- [ ] 實作復原前自動備份 (Failsafe)

### 3.2 上傳檔案復原 API

- [ ] 建立 `src/app/api/admin/restore/uploads/route.ts`
- [ ] 實作 ZIP 解壓縮至 `/public/uploads/`
- [ ] 實作 manifest.json 驗證
- [ ] 實作既有檔案處理策略 (覆蓋)

### 3.3 ISO 文件復原 API

- [ ] 建立 `src/app/api/admin/restore/iso-docs/route.ts`
- [ ] 實作 ZIP 解壓縮至 `/public/iso_doc/`
- [ ] 實作 manifest.json 驗證
- [ ] 實作既有檔案處理策略 (覆蓋)

---

## Phase 4: 復原功能 - 前端 UI

### 4.1 復原區塊元件

- [ ] 擴充 `BackupRestoreSection.tsx` 加入復原區塊
- [ ] 實作檔案選擇 UI (三個上傳區域)
- [ ] 實作確認對話框 (輸入 "RESTORE" 確認)
- [ ] 實作復原進度顯示
- [ ] 實作錯誤處理與提示
- [ ] 實作資料庫復原後重新導向至登入頁

---

## Phase 5: 整合測試與文件

### 5.1 功能測試

- [ ] 測試資料庫備份 (Admin)
- [ ] 測試資料庫備份 (Non-Admin，應失敗)
- [ ] 測試上傳檔案備份
- [ ] 測試 ISO 文件備份
- [ ] 測試資料庫復原 + 強制登出
- [ ] 測試上傳檔案復原
- [ ] 測試 ISO 文件復原
- [ ] 測試損壞備份還原 (應顯示錯誤)

### 5.2 文件更新

- [ ] 更新 `docs/task.md` 加入 Phase 15
- [ ] 更新 `docs/tech.md` 加入技術細節
- [ ] 更新 `README.md` 功能列表

---

## 技術細節備註

### 依賴套件

```bash
npm install archiver @types/archiver adm-zip @types/adm-zip
```

### 關鍵檔案

| 檔案 | 用途 |
|------|------|
| `src/lib/backup-utils.ts` | 備份/復原工具函式 |
| `src/app/api/admin/backup/*/route.ts` | 備份 API |
| `src/app/api/admin/restore/*/route.ts` | 復原 API |
| `src/components/admin/BackupRestoreSection.tsx` | UI 元件 |

### 強制登出實作方式

```typescript
// 方案：清除所有 Session (NextAuth.js)
// 由於 NextAuth 使用 JWT，需要實作 Token 黑名單或強制重新登入
// 實際做法：更新 user.updatedAt，配合 JWT callback 檢查
```
