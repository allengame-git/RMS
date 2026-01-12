# RMS 系統部署檢驗作業規劃

> **文件版本**: 1.2  
> **最後更新**: 2026-01-10

---

## 一、檢驗作業概述

本文件定義 RMS 系統部署後的完整檢驗流程，確保系統穩定運行。

### 檢驗階段

| 階段 | 時機 | 執行者 | 預計時間 |
|------|------|--------|----------|
| 部署前檢驗 | 部署作業前 | IT 人員 | 15 分鐘 |
| 部署後檢驗 | 部署完成後 | IT 人員 | 30 分鐘 |
| 功能驗收檢驗 | 部署後 24 小時內 | IT + 使用者 | 1 小時 |
| 穩定性檢驗 | 部署後一週 | IT 人員 | 15 分鐘 |

---

## 二、部署前檢驗

### 2.1 環境檢驗

| 檢驗項目 | 檢驗指令 | 通過標準 | ✓ |
|----------|----------|----------|---|
| Docker 已安裝 | `docker --version` | 顯示版本 24.x+ | ☐ |
| Docker 正在執行 | `docker info` | 無錯誤訊息 | ☐ |
| Git 已安裝 | `git --version` | 顯示版本 2.x+ | ☐ |
| 磁碟空間 | `Get-PSDrive C` | 可用 > 10 GB | ☐ |
| Port 80 未佔用 | `netstat -an \| findstr :80` | 空白或無 LISTENING | ☐ |
| Port 443 未佔用 | `netstat -an \| findstr :443` | 空白或無 LISTENING | ☐ |
| Port 3000 未佔用 | `netstat -an \| findstr :3000` | 空白或無 LISTENING | ☐ |
| Port 5432 未佔用 | `netstat -an \| findstr :5432` | 空白或無 LISTENING | ☐ |

### 2.2 檔案檢驗

| 檢驗項目 | 檢驗指令 | 通過標準 | ✓ |
|----------|----------|----------|---|
| 專案目錄存在 | `Test-Path C:\RMS` | True | ☐ |
| Dockerfile 存在 | `Test-Path C:\RMS\Dockerfile` | True | ☐ |
| docker-compose.yml 存在 | `Test-Path C:\RMS\docker-compose.yml` | True | ☐ |
| .env 檔案存在 | `Test-Path C:\RMS\.env` | True | ☐ |
| 資料庫備份存在 | `Test-Path C:\RMS\rms_db_dump.sql` | True (如適用) | ☐ |
| SSL 憑證存在 | `Test-Path C:\RMS\nginx\ssl\fullchain.pem` | True | ☐ |
| SSL 私鑰存在 | `Test-Path C:\RMS\nginx\ssl\privkey.pem` | True | ☐ |

### 2.3 設定檢驗

```powershell
# 檢驗 .env 內容 (請手動確認)
Get-Content C:\RMS\.env
```

| 檢驗項目 | 通過標準 | ✓ |
|----------|----------|---|
| DATABASE_URL 已設定 | 格式: postgresql://... | ☐ |
| POSTGRES_PASSWORD 設定 | 與 DATABASE_URL 一致 | ☐ |
| NEXTAUTH_URL 已設定 | 格式正確 (https://...) | ☐ |
| NEXTAUTH_SECRET 已設定 | 至少 32 字元 | ☐ |

---

## 三、部署後檢驗

### 3.1 容器狀態檢驗

```powershell
# 執行檢驗指令
docker compose ps
```

| 容器名稱 | 預期狀態 | 預期埠口 | ✓ |
|----------|----------|----------|---|
| rms-postgres | Up (healthy) | 5432 | ☐ |
| rms-application | Up (healthy) | 3000 | ☐ |
| rms-nginx | Up | 80, 443 | ☐ |

### 3.2 健康檢查 API 檢驗

```powershell
# 執行健康檢查
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/health"
$response | Format-List
```

| 檢驗項目 | 預期結果 | ✓ |
|----------|----------|---|
| status | "ok" | ☐ |
| database | "connected" | ☐ |
| timestamp | 有效日期時間 | ☐ |

### 3.3 網路連線檢驗

| 檢驗項目 | 檢驗方式 | 通過標準 | ✓ |
|----------|----------|----------|---|
| HTTP 重導向 | 瀏覽器開啟 <http://localhost> | 自動跳轉 HTTPS | ☐ |
| HTTPS 連線 | 瀏覽器開啟 <https://localhost> | 顯示登入頁 | ☐ |
| SSL 憑證 | 點擊瀏覽器鎖頭圖示 | 憑證資訊正確 | ☐ |

### 3.4 日誌檢驗

```powershell
# 檢查應用程式日誌
docker logs rms-application --tail 20
```

| 檢驗項目 | 通過標準 | ✓ |
|----------|----------|---|
| 無錯誤訊息 (ERROR) | 日誌中無 ERROR 字樣 | ☐ |
| 無警告訊息 (WARN) | 日誌中無嚴重 WARN | ☐ |
| 啟動成功訊息 | 顯示 "Ready" 或類似字樣 | ☐ |

---

## 四、功能驗收檢驗

### 4.1 使用者認證

| 測試案例 | 操作步驟 | 預期結果 | ✓ |
|----------|----------|----------|---|
| TC-AUTH-01 | 輸入正確帳密登入 | 成功進入首頁 | ☐ |
| TC-AUTH-02 | 輸入錯誤密碼登入 | 顯示錯誤訊息 | ☐ |
| TC-AUTH-03 | 點擊登出 | 回到登入頁 | ☐ |
| TC-AUTH-04 | 未登入訪問受保護頁面 | 重導向登入頁 | ☐ |
| TC-AUTH-05 | 連續 5 次錯誤密碼 | 帳號鎖定 15 分鐘 | ☐ |
| TC-AUTH-06 | 管理員解鎖帳號 | 解鎖成功可登入 | ☐ |
| TC-AUTH-07 | 檢視審計日誌 (`/admin/audit`) | 顯示登入記錄 | ☐ |

### 4.2 專案管理

| 測試案例 | 操作步驟 | 預期結果 | ✓ |
|----------|----------|----------|---|
| TC-PROJ-01 | 檢視專案列表 | 顯示所有專案 | ☐ |
| TC-PROJ-02 | 點擊專案查看詳情 | 顯示專案資訊 | ☐ |
| TC-PROJ-03 | 展開專案項目樹 | 正確顯示階層 (Accordion) | ☐ |

### 4.3 項目管理

| 測試案例 | 操作步驟 | 預期結果 | ✓ |
|----------|----------|----------|---|
| TC-ITEM-01 | 檢視項目詳情 | 顯示完整內容 (New Sidebar) | ☐ |
| TC-ITEM-02 | 新增項目 (EDITOR) | 進入待審核 | ☐ |
| TC-ITEM-03 | 編輯項目 (EDITOR) | 進入待審核 | ☐ |
| TC-ITEM-04 | 審核通過 (INSPECTOR) | 項目更新 | ☐ |
| TC-ITEM-05 | 審核拒絕 (INSPECTOR) | 申請被退回 | ☐ |

### 4.4 檔案管理

| 測試案例 | 操作步驟 | 預期結果 | ✓ |
|----------|----------|----------|---|
| TC-FILE-01 | 上傳新檔案 (< 10MB) | 上傳成功 | ☐ |
| TC-FILE-02 | 上傳大檔案 (> 50MB) | 上傳成功 | ☐ |
| TC-FILE-03 | 下載已上傳檔案 | 下載正確 | ☐ |
| TC-FILE-04 | 刪除檔案 | 進入待審核 | ☐ |

### 4.5 ISO 文件管理

| 測試案例 | 操作步驟 | 預期結果 | ✓ |
|----------|----------|----------|---|
| TC-ISO-01 | 產生說明書 (PDF) | 成功下載 PDF | ☐ |
| TC-ISO-02 | 產生條文對照表 (PDF) | 成功下載 PDF | ☐ |

### 4.6 權限檢驗

| 角色 | 可執行操作 | 不可執行操作 | ✓ |
|------|------------|--------------|---|
| VIEWER | 檢視、搜尋 | 新增、編輯、審核 | ☐ |
| EDITOR | 檢視、新增、編輯 | 審核 | ☐ |
| INSPECTOR | 檢視、審核 | 新增、編輯 | ☐ |
| ADMIN | 所有操作 | 無限制 | ☐ |

---

## 五、穩定性檢驗 (部署後一週)

### 5.1 系統資源檢驗

```powershell
# 檢查容器資源使用
docker stats --no-stream
```

| 檢驗項目 | 通過標準 | ✓ |
|----------|----------|---|
| CPU 使用率 | < 80% | ☐ |
| 記憶體使用 | < 4 GB (含 Postgres) | ☐ |
| 容器重啟次數 | 0 次 | ☐ |

### 5.2 備份檢驗

```powershell
# 檢查備份檔案
Get-ChildItem C:\RMS-Backups -Filter "*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

| 檢驗項目 | 通過標準 | ✓ |
|----------|----------|---|
| 備份檔案存在 | 至少有 7 個 .zip 檔 | ☐ |
| 最新備份時間 | 24 小時內 | ☐ |
| 備份檔案大小 | 合理範圍 (> 100 KB) | ☐ |

### 5.3 磁碟空間檢驗

```powershell
# 檢查磁碟使用
Get-PSDrive C | Select-Object Used, Free
docker system df
```

| 檢驗項目 | 通過標準 | ✓ |
|----------|----------|---|
| 系統磁碟可用空間 | > 10 GB | ☐ |
| Docker 使用空間 | < 20 GB | ☐ |

### 5.4 錯誤日誌檢驗

```powershell
# 檢查過去一週錯誤
docker logs rms-application --since 168h 2>&1 | Select-String "ERROR"
```

| 檢驗項目 | 通過標準 | ✓ |
|----------|----------|---|
| 無重複錯誤 | 無重複出現的錯誤 | ☐ |
| 無系統性錯誤 | 無系統層級錯誤 | ☐ |

---

## 六、檢驗結果記錄表

### 檢驗資訊

| 項目 | 內容 |
|------|------|
| 檢驗日期 | _________________ |
| 檢驗人員 | _________________ |
| 系統版本 | _________________ |
| 檢驗類型 | ☐ 部署後 ☐ 週期性 ☐ 故障後 |

### 檢驗結果摘要

| 階段 | 通過項目 | 失敗項目 | 備註 |
|------|----------|----------|------|
| 部署前檢驗 | _**/**_ | | |
| 部署後檢驗 | _**/**_ | | |
| 功能驗收 | _**/**_ | | |
| 穩定性檢驗 | _**/**_ | | |

### 問題記錄

| 編號 | 問題描述 | 嚴重程度 | 處理狀態 |
|------|----------|----------|----------|
| 1 | | ☐高 ☐中 ☐低 | ☐待處理 ☐已解決 |
| 2 | | ☐高 ☐中 ☐低 | ☐待處理 ☐已解決 |
| 3 | | ☐高 ☐中 ☐低 | ☐待處理 ☐已解決 |

### 簽核

| 角色 | 姓名 | 簽章 | 日期 |
|------|------|------|------|
| 檢驗人員 | | | |
| IT 主管 | | | |

---

## 七、自動化檢驗腳本

儲存為 `scripts/verify.ps1`：

```powershell
#!/usr/bin/env pwsh
# RMS 系統自動檢驗腳本

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  RMS 系統自動檢驗" -ForegroundColor Cyan
Write-Host "  執行時間: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

$errors = @()

# 1. Docker 狀態
Write-Host "`n[1/5] Docker 狀態檢驗..." -ForegroundColor Yellow
try {
    $containers = docker compose ps --format json | ConvertFrom-Json
    foreach ($c in $containers) {
        if ($c.State -eq "running" -or $c.State -eq "Up") {
            Write-Host "  ✓ $($c.Name): Distributed" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $($c.Name): $($c.State)" -ForegroundColor Red
            $errors += "$($c.Name) 狀態異常: $($c.State)"
        }
    }
} catch {
    Write-Host "  ✗ Docker 檢驗失敗: $_" -ForegroundColor Red
    $errors += "Docker 檢驗失敗"
}

# 2. 健康檢查 API
Write-Host "`n[2/5] 健康檢查 API..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 10
    if ($health.status -eq "ok" -and $health.database -eq "connected") {
        Write-Host "  ✓ API 正常, 資料庫已連接" -ForegroundColor Green
    } else {
        Write-Host "  ✗ API 異常: $($health | ConvertTo-Json)" -ForegroundColor Red
        $errors += "健康檢查失敗"
    }
} catch {
    Write-Host "  ✗ 健康檢查失敗: $_" -ForegroundColor Red
    $errors += "健康檢查 API 無法存取"
}

# 3. 備份檔案
Write-Host "`n[3/5] 備份狀態檢驗..." -ForegroundColor Yellow
$backupDir = "C:\RMS-Backups"
if (Test-Path $backupDir) {
    $latestBackup = Get-ChildItem $backupDir -Filter "*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestBackup) {
        $age = (Get-Date) - $latestBackup.LastWriteTime
        if ($age.TotalHours -lt 25) {
            Write-Host "  ✓ 最新備份: $($latestBackup.Name) ($([math]::Round($age.TotalHours,1)) 小時前)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ 備份過期: $($latestBackup.Name) ($([math]::Round($age.TotalDays,1)) 天前)" -ForegroundColor Yellow
            $errors += "備份超過 24 小時未更新"
        }
    } else {
        Write-Host "  ✗ 無備份檔案" -ForegroundColor Red
        $errors += "無備份檔案"
    }
} else {
    Write-Host "  ✗ 備份目錄不存在" -ForegroundColor Red
    $errors += "備份目錄不存在"
}

# 4. 磁碟空間
Write-Host "`n[4/5] 磁碟空間檢驗..." -ForegroundColor Yellow
$drive = Get-PSDrive C
$freeGB = [math]::Round($drive.Free / 1GB, 2)
if ($freeGB -gt 10) {
    Write-Host "  ✓ 可用空間: $freeGB GB" -ForegroundColor Green
} elseif ($freeGB -gt 5) {
    Write-Host "  ⚠ 可用空間偏低: $freeGB GB" -ForegroundColor Yellow
} else {
    Write-Host "  ✗ 可用空間不足: $freeGB GB" -ForegroundColor Red
    $errors += "磁碟空間不足: $freeGB GB"
}

# 5. 錯誤日誌
Write-Host "`n[5/5] 錯誤日誌檢驗..." -ForegroundColor Yellow
$errorLogs = docker logs rms-application --since 1h 2>&1 | Select-String "ERROR"
if ($errorLogs.Count -eq 0) {
    Write-Host "  ✓ 過去 1 小時無錯誤" -ForegroundColor Green
} else {
    Write-Host "  ⚠ 發現 $($errorLogs.Count) 個錯誤" -ForegroundColor Yellow
    $errors += "日誌中有 $($errorLogs.Count) 個錯誤"
}

# 結果摘要
Write-Host "`n===========================================" -ForegroundColor Cyan
if ($errors.Count -eq 0) {
    Write-Host "✓ 所有檢驗通過" -ForegroundColor Green
} else {
    Write-Host "✗ 發現 $($errors.Count) 個問題:" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host "  - $e" -ForegroundColor Red
    }
}
Write-Host "===========================================" -ForegroundColor Cyan
```

執行方式：

```powershell
C:\RMS\scripts\verify.ps1
```
