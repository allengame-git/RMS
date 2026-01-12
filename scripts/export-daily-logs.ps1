#!/usr/bin/env pwsh
# RMS 每日審計日誌匯出腳本
# 用於 Windows 排程任務，每日自動匯出前一天的登入審計日誌

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Date = ""  # 可選：指定日期 YYYY-MM-DD，預設為昨天
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  RMS 每日審計日誌匯出" -ForegroundColor Cyan
Write-Host "  執行時間: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 構建 API URL
$ApiUrl = "$BaseUrl/api/audit/export"
if ($Date) {
    $ApiUrl = "$ApiUrl?date=$Date"
}

Write-Host "`n📤 呼叫 API: $ApiUrl" -ForegroundColor Yellow

try {
    # 呼叫 API 端點
    $Response = Invoke-RestMethod -Uri $ApiUrl -Method GET -TimeoutSec 60

    if ($Response.success) {
        Write-Host "✅ 匯出成功!" -ForegroundColor Green
        Write-Host "   檔案: $($Response.filePath)" -ForegroundColor Green
        Write-Host "   記錄數: $($Response.recordCount)" -ForegroundColor Green
    } else {
        Write-Host "❌ 匯出失敗: $($Response.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ API 呼叫失敗: $_" -ForegroundColor Red
    Write-Host "   請確認服務是否正在運行" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=========================================" -ForegroundColor Cyan
