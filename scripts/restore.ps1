#!/usr/bin/env pwsh
# RMS 系統還原腳本 (PostgreSQL 版本)

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

if (-not (Test-Path $BackupFile)) {
    Write-Host "❌ 備份檔案不存在: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "⚠️ 即將從備份還原系統，當前資料將被覆蓋！" -ForegroundColor Yellow
$Confirm = Read-Host "確定要繼續嗎？(輸入 'YES' 確認)"

if ($Confirm -ne "YES") {
    Write-Host "已取消還原操作" -ForegroundColor Red
    exit
}

# 1. 解壓備份
$RestoreDir = "C:\RMS-Restore-$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "📦 解壓備份至 $RestoreDir..."
Expand-Archive -Path $BackupFile -DestinationPath $RestoreDir

# 找到實際的備份子目錄
$SubDirs = Get-ChildItem -Path $RestoreDir -Directory
if ($SubDirs.Count -eq 1) {
    $RestoreDir = $SubDirs[0].FullName
}

# 2. 驗證備份檔案
if (-not (Test-Path "$RestoreDir\rms_db.sql")) {
    Write-Host "❌ 無效的備份檔案: 找不到 rms_db.sql" -ForegroundColor Red
    exit 1
}

# 3. 還原 PostgreSQL 資料庫
Write-Host "🔄 還原資料庫..."
# 清空現有資料並重新匯入
Get-Content "$RestoreDir\rms_db.sql" | docker exec -i rms-postgres psql -U rms_user -d rms_db
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 資料庫還原失敗" -ForegroundColor Red
} else {
    Write-Host "  ✓ 資料庫還原完成"
}

# 4. 還原上傳檔案
if (Test-Path "$RestoreDir\uploads") {
    Write-Host "📁 還原上傳檔案..."
    docker cp "$RestoreDir\uploads\." rms-application:/app/public/uploads/
    Write-Host "  ✓ 上傳檔案還原完成"
}

# 5. 還原 ISO 文件
if (Test-Path "$RestoreDir\iso_doc") {
    Write-Host "📄 還原 ISO 文件..."
    docker cp "$RestoreDir\iso_doc\." rms-application:/app/public/iso_doc/
    Write-Host "  ✓ ISO 文件還原完成"
}

# 6. 重新啟動應用程式
Write-Host "🔄 重新啟動應用程式..."
docker restart rms-application
Start-Sleep -Seconds 10

# 7. 健康檢查
try {
    $Health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -ErrorAction Stop
    if ($Health.status -eq "ok") {
        Write-Host "✅ 系統還原成功！" -ForegroundColor Green
    } else {
        throw "Health check failed"
    }
} catch {
    Write-Host "❌ 系統啟動異常，請檢查日誌" -ForegroundColor Red
    docker logs rms-application --tail 50
}

# 清理
$ParentDir = Split-Path $RestoreDir -Parent
if ($ParentDir -like "*RMS-Restore*") {
    Remove-Item -Recurse -Force $ParentDir
} else {
    Remove-Item -Recurse -Force $RestoreDir
}
Write-Host "🧹 已清理暫存檔案"
