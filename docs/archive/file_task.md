# 檔案管理功能 - 開發進度 (file_task.md)

> 最後更新: 2026-01-02

## 進度總覽

| Phase | 說明 | 狀態 |
|-------|------|------|
| Phase 1 | 資料庫設計 | ✅ 完成 |
| Phase 2 | 後端 Server Actions | ✅ 完成 |
| Phase 3 | 檔案上傳 API | ✅ 完成 |
| Phase 4 | 前端頁面 | ✅ 完成 |
| Phase 5 | 前端元件 | ✅ 完成 |
| Phase 6 | 審核流程整合 | ✅ 完成 |
| Phase 7 | 導覽整合與測試 | ✅ 完成 |

---

## Phase 1: 資料庫設計

- [ ] 新增 `DataFile` model
  - [ ] 元資料欄位 (dataYear, dataName, dataCode, author, description)
  - [ ] 檔案資訊欄位 (fileName, filePath, fileSize, mimeType)
  - [ ] 狀態與時間欄位
- [ ] 新增 `DataFileChangeRequest` model
- [ ] 新增 `DataFileHistory` model
- [ ] 更新 `User` model 新增關聯
- [ ] 執行 `npx prisma db push`
- [ ] **[檢核]** Schema 正確建立 ✅

## Phase 2: 後端 Server Actions

- [ ] 建立 `src/actions/data-files.ts`
- [ ] 實作查詢功能
  - [ ] `getDataFiles()` - 檔案列表
  - [ ] `getDataFile(id)` - 單一檔案
  - [ ] `searchDataFiles(query)` - 搜尋
- [ ] 實作申請提交
  - [ ] `submitCreateDataFile()` - 新增申請
  - [ ] `submitUpdateDataFile()` - 編輯申請
  - [ ] `submitDeleteDataFile()` - 刪除申請
- [ ] 實作審核處理
  - [ ] `approveDataFileRequest()` - 審核通過
  - [ ] `rejectDataFileRequest()` - 審核拒絕
  - [ ] `getPendingDataFileRequests()` - 待審核列表
- [ ] **[檢核]** Server Actions 功能正常 ✅

## Phase 3: 檔案上傳 API

- [ ] 建立 `src/app/api/datafiles/upload/route.ts`
- [ ] 實作檔案接收邏輯
- [ ] 依年份建立資料夾結構
- [ ] 檔案命名規則 (`{dataCode}_{timestamp}.{ext}`)
- [ ] 大小限制驗證 (100MB)
- [ ] **[檢核]** 上傳功能正常 ✅

## Phase 4: 前端頁面

- [ ] 建立 `src/app/datafiles/page.tsx` - 列表頁
  - [ ] 年份篩選 Tab
  - [ ] 搜尋輸入框
  - [ ] 檔案卡片 Grid
  - [ ] 上傳按鈕 (EDITOR+)
- [ ] 建立 `src/app/datafiles/[id]/page.tsx` - 詳情頁
  - [ ] 元資料顯示
  - [ ] 下載連結
  - [ ] 編輯/刪除按鈕
  - [ ] 歷史紀錄
- [ ] 建立 `src/app/datafiles/search/page.tsx` - 搜尋結果頁
- [ ] **[檢核]** 頁面顯示正常 ✅

## Phase 5: 前端元件

- [ ] `DataFileList.tsx` - 檔案列表元件
- [ ] `DataFileCard.tsx` - 檔案卡片元件
- [ ] `UploadDataFileForm.tsx` - 上傳表單
  - [ ] 5項必填元資料輸入
  - [ ] 檔案選擇與預覽
  - [ ] 提交驗證
- [ ] `EditDataFileButton.tsx` - 編輯按鈕 Modal
- [ ] `DeleteDataFileButton.tsx` - 刪除按鈕與確認
- [ ] `DataFileSearch.tsx` - 搜尋元件
- [ ] `DataFileHistory.tsx` - 歷史紀錄元件
- [ ] **[檢核]** 元件功能正常 ✅

## Phase 6: 審核流程整合

- [ ] 擴充 ChangeRequest 類型支援
  - [ ] `FILE_CREATE`
  - [ ] `FILE_UPDATE`
  - [ ] `FILE_DELETE`
- [ ] 更新 `ApprovalList.tsx` 支援 DataFile
  - [ ] 新增 DataFile 卡片類型
  - [ ] 顯示檔案元資料
  - [ ] 審核操作整合
- [ ] 更新 `getPendingRequests()` 包含 DataFile
- [ ] **[檢核]** 審核流程正常 ✅

## Phase 7: 導覽整合與測試

- [ ] 更新主選單新增「檔案管理」入口
- [ ] 完整功能測試
  - [ ] 上傳流程測試
  - [ ] 權限控管測試
  - [ ] 審核流程測試
  - [ ] 搜尋功能測試
  - [ ] 編輯/刪除測試
  - [ ] 年份分類測試
- [ ] **[檢核]** 全系統整合測試通過 ✅

---

## 權限速查

| 操作 | VIEWER | EDITOR | INSPECTOR | ADMIN |
|------|:------:|:------:|:---------:|:-----:|
| 瀏覽 | ✅ | ✅ | ✅ | ✅ |
| 上傳 | ❌ | ✅* | ✅* | ✅ |
| 編輯 | ❌ | ✅* | ✅* | ✅ |
| 刪除 | ❌ | ✅* | ✅* | ✅ |
| 審核 | ❌ | ❌ | ✅ | ✅ |

> *需經審核
