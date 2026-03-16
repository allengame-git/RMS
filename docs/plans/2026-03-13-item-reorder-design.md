# Item Reorder / Renumber / Move 設計文件

日期：2026-03-13

## 問題

`fullId`（如 `WQ-1-2-3`）同時作為識別碼和排序依據，建立後無法調整順序、插入或重新編號。需要支援：插入、重排、跨層級移動、刪除後重新編號。

## 決策

- **方案 B：直接修改 fullId + 級聯更新**，不新增 `sortOrder` 欄位
- 不走審批流程，ADMIN / INSPECTOR 直接操作
- 歷史紀錄同步更新（`ItemHistory.itemFullId`）
- 富文字連結同步更新（`Item.content` 中的 `data-item-id`）
- PENDING ChangeRequest 中的預分配 fullId 同步更新

## 三個核心操作

### 1. Reorder（同層重新排序）

同一個 parent 下，依指定順序重算所有子項目的 `fullId` 尾段數字。

```typescript
reorderItems(parentId: number | null, projectId: number, orderedItemIds: number[])
```

### 2. Move（跨層級移動）

把一個項目（含子樹）移到另一個 parent 下的指定位置。更新 `parentId`，重算移入項目及子樹的 `fullId`，重算原 parent 下剩餘項目的 `fullId`。

```typescript
moveItem(itemId: number, newParentId: number | null, position: number)
```

移動前檢查祖先鏈，防止循環（把 parent 移到自己的子孫下）。

### 3. Renumber（重新編號）

對某個 parent 下所有子項目按目前順序重新編為連續數字。可選遞迴處理子層級。

```typescript
renumberItems(parentId: number | null, projectId: number, recursive: boolean)
```

## 級聯更新範圍

所有操作在單一 `prisma.$transaction` 內完成：

| 目標 | 查找方式 | 更新方式 |
|------|---------|---------|
| `Item.fullId`（本項 + 子孫） | by id / `fullId LIKE 'old-%'` | 替換前綴 |
| `ItemHistory.itemFullId` | `= old` 或 `LIKE 'old-%'` | 替換前綴 |
| `Item.content`（所有項目） | `content LIKE '%old-fullId%'` | 字串替換 `data-item-id` 屬性及顯示文字 |
| PENDING `ChangeRequest.data` | `status=PENDING`，JSON 含舊 fullId | 解析 JSON，替換 fullId 和 content 中的連結 |

## 避免 Unique Constraint 衝突：兩階段更新

批次重新編號時多個 fullId 交叉變更會撞 unique constraint。

1. 先把所有要改的 `fullId` 改成臨時值（`__TEMP_` 前綴）
2. 再把臨時值改成最終值

## 權限

- 僅 `ADMIN` 和 `INSPECTOR` 可操作
- 檢查目標項目存在且未軟刪除

## 歷史紀錄

- 對每個被改動的項目寫一筆 `ItemHistory`
- 新增 `changeType: "REORDER"`
- 記錄 `oldFullId` → `newFullId`
- 不增加 `currentVersion`（非內容變更）

## UI 介面

### 重新排序

- 箭頭按鈕（▲▼）：同層內一次移一格
- 「管理順序」彈窗：拖拉排序後一次送出

### 跨層級移動

- 操作選單「移動到...」→ 彈出樹狀選擇器
- 選擇目標 parent 和插入位置
- 預覽移動後的新 `fullId`

### 重新編號

- parent 節點操作選單「重新編號子項目」
- 確認對話框顯示舊 ID → 新 ID 對照表
- 可勾選「包含所有子層級」

### 共通

- 所有操作顯示預覽確認
- 操作中顯示 loading，防止重複提交
- 完成後顯示成功訊息，頁面自動重整

## Server Action 回傳格式

```typescript
{
  success: boolean;
  error?: string;
  data?: {
    changes: { itemId: number; oldFullId: string; newFullId: string }[];
  };
}
```

## 錯誤處理

| 錯誤情境 | 處理 |
|---------|------|
| 目標 parent 不存在或已刪除 | 回傳錯誤 |
| 移動造成循環 | 檢查祖先鏈，回傳錯誤 |
| Transaction 失敗 | 整筆回滾 |
| 並行操作 | DB transaction 隔離保護 |

## 涉及檔案（預估）

| 檔案 | 變更 |
|------|------|
| `src/actions/item-reorder.ts` | 新建 — 三個 Server Action |
| `src/lib/item-utils.ts` | 新增級聯更新工具函式 |
| `src/components/item/ItemTree.tsx` | 加排序箭頭、操作選單 |
| `src/components/item/ReorderDialog.tsx` | 新建 — 拖拉排序彈窗 |
| `src/components/item/MoveItemDialog.tsx` | 新建 — 移動目標選擇器 |
| `src/components/item/RenumberDialog.tsx` | 新建 — 重新編號確認 |
| `src/app/items/[id]/page.tsx` | 加操作按鈕入口 |
| `src/app/projects/[id]/page.tsx` | 加操作按鈕入口 |
| CSS 檔案 | 新元件樣式 |
