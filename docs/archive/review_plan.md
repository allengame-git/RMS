# 審核流程通知與退回機制 - 實作計畫

> 最後更新: 2026-01-08

## 目標

1. **通知功能**: 當審查者拒絕變更申請時，通知 Editor 申請被退回
2. **QC/PM 退回機制**: QC 或 PM 拒絕品質文件時，流程退回 Editor 進行修改後重新提交
3. **完整紀錄**: 所有退回/重新提交紀錄保留於歷史頁面及品質文件 PDF

---

## 現況分析

### 現有流程

```
Editor 提交 → ChangeRequest (PENDING) → Inspector/Admin 審核
                                              ↓
                              APPROVED (寫入 Item + History)
                              REJECTED (無通知, 流程結束)
```

```
Item 變更核准 → ItemHistory + QCDocumentApproval (PENDING_QC)
                        ↓
              QC 審核 → PENDING_PM → PM 審核 → COMPLETED
                 ↓                      ↓
              REJECTED              REJECTED (流程結束, 無退回機制)
```

### 問題

| 問題 | 影響 |
|------|------|
| 無通知機制 | Editor 不知道申請被拒絕 |
| 拒絕 = 終止 | QC/PM 拒絕後無法修改重新提交 |
| 無修改紀錄 | 退回原因與修改歷程未保留 |

---

## 設計方案

### Phase 1: 通知系統

#### 1.1 Notification 資料模型

```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  type        String   // REJECTION, REVISION_REQUEST, APPROVAL, etc.
  title       String
  message     String
  link        String?  // 跳轉連結
  
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  // 可選：關聯來源
  changeRequestId Int?
  qcApprovalId    Int?
}
```

#### 1.2 通知觸發點

| 事件 | 通知對象 | 訊息內容 |
|------|----------|---------|
| `rejectRequest` | 提交者 | 「您的變更申請 [項目ID] 已被退回」+ 審查意見 |
| `rejectQCDocument` | 提交者 | 「品質文件 [文件ID] 需要修改」+ QC/PM 意見 |
| `approveRequest` | 提交者 | 「您的變更申請 [項目ID] 已核准」 |
| `approveAsPM` | 提交者 | 「品質文件 [文件ID] 已完成審核」 |

#### 1.3 前端元件

- **NotificationBell**: 導覽列鈴鐺圖示 + 未讀數量 Badge
- **NotificationDropdown**: 下拉選單顯示最新通知
- **NotificationPage**: `/notifications` 完整通知列表

---

### Phase 2: QC/PM 退回重新提交機制

#### 2.1 流程變更

```
QC/PM 拒絕 → QCDocumentApproval.status = 'REVISION_REQUIRED'
                     ↓
           通知 Editor (附帶修改意見)
                     ↓
           Editor 修改 Item 內容
                     ↓
           自動/手動重新提交審核
                     ↓
           新的 ItemHistory + 關聯原始 QCDocumentApproval
```

#### 2.2 資料模型擴充

```prisma
model QCDocumentApproval {
  // ... 現有欄位
  
  // 新增：修訂追蹤
  status          String  // 新增 'REVISION_REQUIRED' 狀態
  revisionCount   Int     @default(0)
  
  // 新增：修訂歷程
  revisions       QCDocumentRevision[]
}

model QCDocumentRevision {
  id              Int      @id @default(autoincrement())
  approvalId      Int
  approval        QCDocumentApproval @relation(fields: [approvalId], references: [id])
  
  revisionNumber  Int
  requestedById   String   // QC/PM who requested revision
  requestedBy     User     @relation(fields: [requestedById], references: [id])
  requestedAt     DateTime @default(now())
  requestNote     String   // 修改要求說明
  
  resolvedAt      DateTime?
  resolvedItemHistoryId Int?  // 修改後產生的新 ItemHistory
}
```

#### 2.3 狀態流程圖

```
PENDING_QC ──┬── QC 核准 ──→ PENDING_PM ──┬── PM 核准 ──→ COMPLETED
             │                             │
             └── QC 退回 ──→ REVISION_REQUIRED ←── PM 退回 ──┘
                                  │
                           Editor 修改
                                  │
                           重新提交審核
                                  │
                            PENDING_QC
```

---

### Phase 3: PDF 歷程紀錄

#### 3.1 PDF 擴充內容

在 `generateHistoryPagePDF` 中加入修訂歷程區塊：

```html
<div class="revision-history">
  <h2>修訂歷程</h2>
  <table>
    <tr><th>版次</th><th>退回者</th><th>修改要求</th><th>完成時間</th></tr>
    <!-- 各次修訂紀錄 -->
  </table>
</div>
```

#### 3.2 歷史頁面擴充

在 `/admin/history/detail/[id]` 頁面調整：

**審查紀錄詳情區塊**:

- 顯示完整審核過程 (提交 → 審查 → QC → PM)
- 各階段退回/重新提交紀錄
- 每次退回的原因與修改說明

**變更內容比對**:

- 僅比對「前一版本」與「本次最終核定版本」
- 不顯示中間修訂過程的 Diff
- 簡化視覺呈現，聚焦於最終結果

---

## 實作優先順序

| 階段 | 功能 | 複雜度 | 預估時間 |
|------|------|--------|---------|
| Phase 1.1 | Notification Model + Server Actions | 中 | 2hr |
| Phase 1.2 | NotificationBell + Dropdown UI | 中 | 2hr |
| Phase 1.3 | 整合 rejectRequest 觸發通知 | 低 | 1hr |
| Phase 2.1 | REVISION_REQUIRED 狀態 + QCDocumentRevision Model | 中 | 2hr |
| Phase 2.2 | rejectQCDocument 改為退回流程 | 中 | 2hr |
| Phase 2.3 | Editor 修改後重新提交 UI | 高 | 3hr |
| Phase 3.1 | PDF 修訂歷程區塊 | 中 | 2hr |
| Phase 3.2 | 歷史頁面修訂時間軸 | 高 | 3hr |

**總計**: 約 17 小時

---

## 技術注意事項

### 資料庫遷移

- 需新增 `Notification` 表
- 需新增 `QCDocumentRevision` 表
- `QCDocumentApproval` 新增欄位

### 效能考量

- 通知查詢需加入索引 (`userId`, `isRead`, `createdAt`)
- 考慮定期清理舊通知 (例如 90 天前)

### 向後相容

- 現有 REJECTED 狀態的文件維持原樣
- 新流程僅適用於新建立的審核紀錄

---

## 驗證計畫

### Phase 1 驗證

1. Inspector 拒絕變更申請 → Editor 收到通知
2. 點擊通知跳轉至對應頁面
3. 已讀狀態正確更新

### Phase 2 驗證

1. QC 退回品質文件 → Editor 收到通知 (含修改意見)
2. Editor 修改內容後重新提交
3. 文件回到 PENDING_QC 狀態
4. 修訂計數器增加

### Phase 3 驗證

1. 品質文件 PDF 包含修訂歷程表格
2. 歷史詳情頁顯示完整修訂時間軸
