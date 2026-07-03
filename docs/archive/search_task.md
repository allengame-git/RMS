# 專案內搜尋功能 - 執行清單 (search_task.md)

> 最後更新: 2026-01-02  
> 參考文件: [search_fnc.md](./search_fnc.md)

## 執行總覽

| Phase | 說明 | 預估工時 | 狀態 |
|-------|------|----------|------|
| Phase 1 | 後端 Server Actions | 2h | ⬜ 未開始 |
| Phase 2 | 前端 UI 元件 | 3h | ⬜ 未開始 |
| Phase 3 | 驗證與測試 | 1h | ⬜ 未開始 |

---

## Phase 1: 後端 Server Actions (2h)

### 1.1 建立 Server Action

- [ ] 建立 `src/actions/search.ts`
- [ ] 實作 `searchProjectItems(projectId, query)`
  - [ ] Prisma 查詢 (title + content, insensitive)
  - [ ] 過濾 `isDeleted = false`
  - [ ] 限制結果數量 (50 筆)

### 1.2 實作排序邏輯

- [ ] 建立 `src/lib/search-utils.ts`
- [ ] 實作 `naturalSort(items, key)` 函數
  - [ ] 正確處理 `WQ-1`, `WQ-1-1`, `WQ-2` 排序
  - [ ] 單元測試: 驗證排序順序

### 1.3 實作片段生成

- [ ] 實作 `generateSnippets(title, content, query)` 函數
  - [ ] 提取關鍵字上下文 (前後 60 字元)
  - [ ] 最多 3 個片段
  - [ ] 加上省略符號 (`...`)
  - [ ] 記錄 `matchStart`, `matchLength`, `source`
- [ ] 單元測試: 驗證片段正確性

### 1.4 型別定義

- [ ] 定義 `SearchResult` 介面
- [ ] 定義 `Snippet` 介面

---

## Phase 2: 前端 UI 元件 (3h)

### 2.1 搜尋輸入框

- [ ] 建立 `src/components/search/ProjectSearchBar.tsx`
  - [ ] 輸入框 UI (帶搜尋圖示)
  - [ ] 實作 debounce (300ms)
  - [ ] 最少 2 字元才觸發搜尋
  - [ ] Loading 狀態顯示

### 2.2 搜尋結果列表

- [ ] 建立 `src/components/search/SearchResultList.tsx`
  - [ ] 顯示結果數量 (`找到 X 個符合 "關鍵字" 的項目`)
  - [ ] 無結果時顯示提示訊息
  - [ ] 遍歷 `SearchResultCard`

### 2.3 搜尋結果卡片

- [ ] 建立 `src/components/search/SearchResultCard.tsx`
  - [ ] 顯示 `fullId` + `title`
  - [ ] 顯示高亮片段 (最多 3 個)
  - [ ] 「查看詳情」連結 (`/items/[id]`)

### 2.4 高亮顯示元件

- [ ] 建立 `src/components/search/HighlightedSnippet.tsx`
  - [ ] 使用 `<mark>` 標籤高亮關鍵字
  - [ ] 樣式: 背景色 `var(--color-warning-soft)`

### 2.5 整合至專案頁面

- [ ] 修改 `src/app/projects/[id]/page.tsx`
  - [ ] 在專案標題下方加入 `ProjectSearchBar`
  - [ ] 加入搜尋結果顯示區域
  - [ ] Client Component 狀態管理 (query, results, loading)

---

## Phase 3: 驗證與測試 (1h)

### 3.1 功能驗證

- [ ] **搜尋標題**：輸入標題關鍵字，驗證正確匹配
- [ ] **搜尋內容**：輸入內容關鍵字，驗證正確匹配
- [ ] **同時匹配**：關鍵字同時出現在標題與內容
- [ ] **大小寫不敏感**：`user` 應匹配 `User`, `USER`
- [ ] **結果排序**：驗證 `WQ-1` < `WQ-1-1` < `WQ-2` < `WQ-10`

### 3.2 片段顯示驗證

- [ ] **高亮關鍵字**：關鍵字正確用 `<mark>` 標籤包裹
- [ ] **片段截斷**：開頭/結尾截斷時顯示 `...`
- [ ] **多個匹配**：最多顯示 3 個片段
- [ ] **來源標記**：正確標示 `title` 或 `content`

### 3.3 邊界情況測試

- [ ] **無結果**：搜尋不存在的關鍵字，顯示「未找到結果」
- [ ] **短關鍵字**：1 字元不觸發搜尋
- [ ] **特殊字元**：搜尋 `[`, `*`, `-` 不出錯
- [ ] **HTML 標籤**：內容中的 `<script>` 等標籤正確 escape
- [ ] **已刪除項目**：不出現在搜尋結果中

### 3.4 效能測試

- [ ] **Debounce**：快速輸入時不應每次都查詢
- [ ] **大量結果**：50+ 結果時 UI 不卡頓
- [ ] **查詢效率**：搜尋時間 < 1 秒 (中小型專案)

### 3.5 UI/UX 驗證

- [ ] **響應式設計**：手機/平板/桌面顯示正常
- [ ] **Loading 狀態**：搜尋時顯示 Loading 指示器
- [ ] **鍵盤操作**：Enter 鍵觸發搜尋，Esc 清空
- [ ] **結果連結**：點擊「查看詳情」正確導航

---

## 驗證腳本

### 測試資料準備

建立測試專案與 Items：

```
專案: TEST-SEARCH (TS)
├─ TS-1: 使用者登入功能
│  └─ TS-1-1: 密碼加密機制
├─ TS-2: 系統權限管理
│  ├─ TS-2-1: 使用者角色定義
│  └─ TS-2-2: 權限矩陣設計
└─ TS-10: 效能優化需求
```

### 測試案例

| 測試案例 | 搜尋關鍵字 | 預期結果 |
|----------|-----------|---------|
| 標題匹配 | `使用者` | TS-1, TS-2-1 (依序顯示) |
| 內容匹配 | `密碼` | TS-1-1 (片段高亮) |
| 大小寫 | `USER` | 同 `使用者` |
| 排序 | `權限` | TS-2, TS-2-2 (正確順序) |
| 多片段 | `系統` | 顯示最多 3 個匹配片段 |
| 無結果 | `不存在關鍵字` | 顯示「未找到結果」 |

---

## 完成檢核

- [ ] 所有 Phase 1 任務完成
- [ ] 所有 Phase 2 任務完成
- [ ] 所有 Phase 3 驗證通過
- [ ] 程式碼通過 lint 檢查
- [ ] 更新 `docs/tech.md` (新增搜尋功能說明)
- [ ] 更新 `docs/task.md` (標記完成)
- [ ] 建立 Walkthrough (含截圖示例)
