#!/usr/bin/env pwsh
# RMS 系統自動檢驗腳本 (PostgreSQL 版本)

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
Write-Host "`n[5/6] 錯誤日誌檢驗..." -ForegroundColor Yellow
$errorLogs = docker logs rms-application --since 1h 2>&1 | Select-String "ERROR"
if ($errorLogs.Count -eq 0) {
    Write-Host "  ✓ 過去 1 小時無錯誤" -ForegroundColor Green
} else {
    Write-Host "  ⚠ 發現 $($errorLogs.Count) 個錯誤" -ForegroundColor Yellow
    $errors += "日誌中有 $($errorLogs.Count) 個錯誤"
}

# 6. 登入審計日誌
Write-Host "`n[6/6] 審計日誌檢驗..." -ForegroundColor Yellow
try {
    $auditCount = docker exec rms-postgres psql -U rms_user -d rms_db -t -c "SELECT COUNT(*) FROM \"LoginLog\";" 2>$null
    if ($auditCount -match '\d+') {
        $count = [int]($auditCount -replace '\D', '')
        Write-Host "  ✓ 登入審計記錄: $count 筆" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ 無法取得審計記錄數量" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ 審計日誌檢驗失敗: $_" -ForegroundColor Red
    $errors += "審計日誌檢驗失敗"
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
