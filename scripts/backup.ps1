#!/usr/bin/env pwsh
# RMS 系統自動備份腳本 (PostgreSQL 版本)

param(
    [string]$BackupDir = "C:\RMS-Backups",
    [int]$RetentionDays = 30
)

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = Join-Path $BackupDir $Timestamp

# 建立備份目錄
New-Item -ItemType Directory -Force -Path $BackupPath | Out-Null

Write-Host "🔄 開始備份 RMS 系統..." -ForegroundColor Cyan

# 1. 備份 PostgreSQL 資料庫
Write-Host "📦 備份資料庫..."
docker exec rms-postgres pg_dump -U rms_user -d rms_db > "$BackupPath\rms_db.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 資料庫備份失敗" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ 資料庫備份完成"

# 2. 備份上傳檔案
Write-Host "📁 備份上傳檔案..."
docker cp rms-application:/app/public/uploads "$BackupPath\uploads" 2>$null
if (Test-Path "$BackupPath\uploads") {
    Write-Host "  ✓ 上傳檔案備份完成"
} else {
    Write-Host "  - 無上傳檔案需要備份"
    New-Item -ItemType Directory -Force -Path "$BackupPath\uploads" | Out-Null
}

# 3. 備份 ISO 文件
Write-Host "📄 備份 ISO 文件..."
docker cp rms-application:/app/public/iso_doc "$BackupPath\iso_doc" 2>$null
if (Test-Path "$BackupPath\iso_doc") {
    Write-Host "  ✓ ISO 文件備份完成"
} else {
    Write-Host "  - 無 ISO 文件需要備份"
    New-Item -ItemType Directory -Force -Path "$BackupPath\iso_doc" | Out-Null
}

# 4. 壓縮備份
Write-Host "🗜️ 壓縮備份檔案..."
$ZipPath = "$BackupPath.zip"
Compress-Archive -Path $BackupPath -DestinationPath $ZipPath
Remove-Item -Recurse -Force $BackupPath

# 5. 清理過期備份
Write-Host "🧹 清理過期備份..."
$Removed = Get-ChildItem -Path $BackupDir -Filter "*.zip" | 
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) }
if ($Removed) {
    $Removed | Remove-Item -Force
    Write-Host "  ✓ 已清理 $($Removed.Count) 個過期備份"
} else {
    Write-Host "  - 無過期備份需要清理"
}

# 6. 記錄備份完成
$BackupSize = (Get-Item $ZipPath).Length / 1MB
Write-Host "✅ 備份完成: $ZipPath ($([math]::Round($BackupSize, 2)) MB)" -ForegroundColor Green

# 輸出備份資訊
@{
    Timestamp = $Timestamp
    Path = $ZipPath
    SizeMB = [math]::Round($BackupSize, 2)
    Database = "PostgreSQL"
} | ConvertTo-Json | Out-File "$BackupDir\latest_backup.json"
