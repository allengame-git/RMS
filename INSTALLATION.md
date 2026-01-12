# RMS 系統 Windows 全新安裝指南

> **版本**: 1.0  
> **日期**: 2026-01-10  
> **適用對象**: 全新 Windows 環境安裝

---

## 系統需求

| 項目 | 最低需求 | 建議配置 |
|------|----------|----------|
| 作業系統 | Windows 10 Pro/Enterprise | Windows 11 Pro |
| RAM | 8 GB | 16 GB |
| 硬碟空間 | 20 GB | 50 GB (SSD) |
| CPU | 4 核心 | 8 核心 |
| 網路 | 可連線至 GitHub | 固定 IP (內網存取) |

---

## 安裝步驟

### 步驟 1：安裝必要軟體

#### 方法 A：線上安裝（需網路）

以**系統管理員**身份開啟 PowerShell，執行以下指令：

```powershell
# 安裝 Chocolatey 套件管理器 (若尚未安裝)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 安裝 Docker Desktop 和 Git
choco install docker-desktop git -y

# 重新啟動電腦
Restart-Computer
```

#### 方法 B：離線安裝（無網路環境）

在有網路的電腦上預先下載以下安裝檔，再透過 USB 隨身碟複製到目標電腦：

| 軟體 | 下載連結 | 檔案名稱 |
|------|----------|----------|
| Docker Desktop | <https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe> | `Docker Desktop Installer.exe` |
| Git for Windows | <https://github.com/git-for-windows/git/releases/latest> | `Git-x.x.x-64-bit.exe` |
| OpenSSL (選擇性) | <https://slproweb.com/products/Win32OpenSSL.html> | `Win64OpenSSL-x_x_x.exe` |

**離線安裝步驟：**

1. 將下載的安裝檔複製到目標電腦（例如 `C:\Installers\`）

2. 安裝 Docker Desktop：

   ```powershell
   # 以系統管理員身份執行
   Start-Process "C:\Installers\Docker Desktop Installer.exe" -Wait
   ```

3. 安裝 Git：

   ```powershell
   Start-Process "C:\Installers\Git-2.47.0-64-bit.exe" -ArgumentList "/VERYSILENT /NORESTART" -Wait
   ```

4. 安裝 OpenSSL（選擇性，用於產生 SSL 憑證）：

   ```powershell
   Start-Process "C:\Installers\Win64OpenSSL-3_3_0.exe" -ArgumentList "/VERYSILENT /NORESTART" -Wait
   ```

5. 重新啟動電腦

**離線傳輸專案：**

如果目標電腦無法連線 GitHub，請在有網路的電腦上：

```bash
# 下載專案為 ZIP
git clone https://github.com/YOUR_USERNAME/RMS.git
cd RMS
zip -r RMS-project.zip . -x ".git/*" -x "node_modules/*"
```

將 `RMS-project.zip` 複製到目標電腦後解壓縮：

```powershell
Expand-Archive -Path "C:\Installers\RMS-project.zip" -DestinationPath "C:\RMS"
```

> ⚠️ 安裝 Docker Desktop 後需重新啟動電腦

---

### 步驟 2：驗證安裝

重新開機後，開啟 PowerShell 驗證：

```powershell
docker --version    # 應顯示 Docker version 24.x+
git --version       # 應顯示 git version 2.x+
```

確認 Docker Desktop 已啟動（系統匣圖示為綠色）。

---

### 步驟 3：Clone 專案

```powershell
# 建立專案目錄
mkdir C:\RMS
cd C:\RMS

# 從 GitHub Clone 專案
git clone https://github.com/YOUR_USERNAME/RMS.git .
```

> 💡 將 `YOUR_USERNAME/RMS` 替換為實際的 GitHub 儲存庫路徑

---

### 步驟 4：設定環境變數

```powershell
# 產生安全密鑰
$secret = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
Write-Host "NEXTAUTH_SECRET: $secret"

# 建立 .env 檔案
@"
# PostgreSQL Database
POSTGRES_PASSWORD=rms_secure_password_2026
DATABASE_URL=postgresql://rms_user:rms_secure_password_2026@postgres:5432/rms_db?schema=public

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$secret

# Environment
NODE_ENV=production
"@ | Out-File -FilePath ".env" -Encoding UTF8
```

> ⚠️ **重要**: 請自行修改 `POSTGRES_PASSWORD` 為更安全的密碼，並同步更新 `DATABASE_URL` 中的密碼

---

### 步驟 5：建立 SSL 憑證 (選擇性)

**內部測試用 (自簽憑證):**

```powershell
# 安裝 OpenSSL
choco install openssl -y

# 建立憑證目錄
mkdir C:\RMS\nginx\ssl

# 產生自簽憑證
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout "C:\RMS\nginx\ssl\privkey.pem" `
    -out "C:\RMS\nginx\ssl\fullchain.pem" `
    -subj "/CN=localhost"
```

---

### 步驟 6：構建並啟動服務

```powershell
cd C:\RMS

# 構建 Docker 映像 (首次約 5-10 分鐘)
docker compose build

# 啟動所有服務
docker compose up -d

# 檢查容器狀態
docker compose ps
```

預期輸出：

```
NAME              STATUS    PORTS
rms-postgres      Up        5432/tcp
rms-application   Up        0.0.0.0:3000->3000/tcp
rms-nginx         Up        0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

---

### 步驟 7：初始化資料庫

```powershell
# 等待資料庫啟動
Start-Sleep -Seconds 15

# 執行資料庫遷移
docker exec rms-application npx prisma migrate deploy

# 產生 Prisma Client
docker exec rms-application npx prisma generate
```

---

### 步驟 8：建立管理員帳號

```powershell
# 進入容器內執行 seed 腳本
docker exec -it rms-application npx ts-node scripts/seed-admin.ts
```

或手動透過資料庫：

```powershell
# 進入 PostgreSQL CLI
docker exec -it rms-postgres psql -U rms_user -d rms_db

# 執行 SQL (密碼: admin123，建議登入後立即修改)
INSERT INTO "User" (id, username, password, role, "isQC", "isPM", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'admin',
    '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjQQ.5cvwPwSv8xFN0eTbF8CQkqIRq',
    'ADMIN',
    true,
    true,
    NOW(),
    NOW()
);
\q
```

---

### 步驟 9：驗證服務

在瀏覽器開啟：

- **HTTP**: <http://localhost:3000>
- **HTTPS**: <https://localhost> (若已設定 SSL)

使用管理員帳號登入：

- 帳號: `admin`
- 密碼: `admin123` (請立即修改)

---

### 步驟 10：設定 Windows 防火牆

```powershell
# 開放 HTTP/HTTPS 埠
New-NetFirewallRule -DisplayName "RMS HTTP" -Direction Inbound -Port 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "RMS HTTPS" -Direction Inbound -Port 443 -Protocol TCP -Action Allow
```

---

## 每週自動備份設定

### 1. 建立備份目錄

```powershell
mkdir C:\RMS-Backups
```

### 2. 建立每週備份排程

```powershell
# 建立排程任務 (每週日凌晨 2:00 執行)
$Action = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-File C:\RMS\scripts\backup.ps1 -BackupDir C:\RMS-Backups -RetentionDays 60"

$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "02:00"

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -WakeToRun

Register-ScheduledTask `
    -TaskName "RMS-WeeklyBackup" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "RMS 系統每週自動備份 (週日 02:00)"

# 驗證排程任務
Get-ScheduledTask -TaskName "RMS-WeeklyBackup"
```

### 3. 手動測試備份

```powershell
C:\RMS\scripts\backup.ps1 -BackupDir "C:\RMS-Backups"
```

### 4. 檢視備份檔案

```powershell
Get-ChildItem C:\RMS-Backups -Filter "*.zip" | Sort-Object LastWriteTime -Descending
```

---

## 每日審計日誌匯出設定

系統會將登入審計日誌匯出為 JSON 檔案，存放於 `daily_logs` 資料夾。

### 1. 手動匯出

```powershell
# 匯出昨天的日誌
Invoke-RestMethod -Uri "http://localhost:3000/api/audit/export" -Method GET

# 匯出指定日期的日誌
Invoke-RestMethod -Uri "http://localhost:3000/api/audit/export?date=2026-01-11" -Method GET
```

### 2. 建立每日匯出排程

```powershell
# 建立排程任務 (每日凌晨 1:00 執行)
$Action = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-File C:\RMS\scripts\export-daily-logs.ps1"

$Trigger = New-ScheduledTaskTrigger -Daily -At "01:00"

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd

Register-ScheduledTask `
    -TaskName "RMS-DailyAuditExport" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "RMS 每日審計日誌匯出 (01:00)"

# 驗證排程任務
Get-ScheduledTask -TaskName "RMS-DailyAuditExport"
```

### 3. 檢視匯出檔案

```powershell
Get-ChildItem C:\RMS\daily_logs -Filter "*.json" | Sort-Object LastWriteTime -Descending
```

---

## 常用指令

| 操作 | 指令 |
|------|------|
| 啟動服務 | `docker compose up -d` |
| 停止服務 | `docker compose down` |
| 重啟服務 | `docker compose restart` |
| 查看日誌 | `docker compose logs -f` |
| 檢查狀態 | `docker compose ps` |
| 進入資料庫 | `docker exec -it rms-postgres psql -U rms_user -d rms_db` |
| 執行驗證 | `C:\RMS\scripts\verify.ps1` |
| 手動備份 | `C:\RMS\scripts\backup.ps1 -BackupDir C:\RMS-Backups` |

---

## 故障排除

| 問題 | 解決方案 |
|------|----------|
| Docker 無法啟動 | 確認已啟用 WSL 2，重新安裝 Docker Desktop |
| 資料庫連線失敗 | 檢查 `.env` 中的 `DATABASE_URL` 密碼是否一致 |
| Port 已被佔用 | 執行 `netstat -an | findstr :3000` 找出佔用程序 |
| 容器無法啟動 | 執行 `docker compose logs` 檢查錯誤訊息 |

---

## 相關文件

- [部署規劃文件](deployment_guide.md)
- [部署步驟指南](deployment_steps.md)
- [部署檢驗清單](deployment_checklist.md)
