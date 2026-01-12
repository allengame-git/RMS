# RMS 系統 Windows 部署 Step-by-Step 指南

> **文件版本**: 1.2  
> **最後更新**: 2026-01-10

---

## 第一部分：準備工作

### Step 1: 確認 Windows 環境需求

在目標 Windows 電腦上確認以下條件：

| 項目 | 最低需求 | 建議配置 |
|------|----------|----------|
| 作業系統 | Windows 10 Pro/Enterprise | Windows 11 Pro |
| RAM | 8 GB | 16 GB |
| 硬碟空間 | 20 GB | 50 GB (SSD) |
| CPU | 4 核心 | 8 核心 |

### Step 2: 安裝必要軟體

在 Windows 電腦上依序安裝：

**2.1 安裝 Docker Desktop**

```powershell
# 方法一：使用 Chocolatey (如已安裝)
choco install docker-desktop

# 方法二：手動下載
# 前往 https://www.docker.com/products/docker-desktop 下載安裝
```

> ⚠️ 安裝後需重新啟動電腦，並在 Docker Desktop 設定中啟用 WSL 2

**2.2 安裝 Git**

```powershell
# 使用 Chocolatey
choco install git

# 或手動下載：https://git-scm.com/download/win
```

**2.3 驗證安裝**

```powershell
docker --version    # 應顯示 Docker version 24.x 或更高
git --version       # 應顯示 git version 2.x
```

---

## 第二部分：專案遷移

### Step 3: 打包專案 (在原始電腦執行)

**3.1 確保所有變更已提交**

```bash
cd /path/to/TEST\ RMS
git status           # 確認沒有未提交的變更
git add -A
git commit -m "準備部署到 Windows"
git push origin main
```

**3.2 打包專案檔案**

```bash
# 建立部署包 (排除 node_modules 和 .next)
zip -r RMS-deployment.zip . \
    -x "node_modules/*" \
    -x ".next/*" \
    -x ".git/*"
```

**3.3 匯出資料庫 (PostgreSQL)**

```bash
# 匯出資料庫架構與數據
docker exec rms-postgres pg_dump -U rms_user -d rms_db > rms_db_dump.sql
```

### Step 4: 傳輸到 Windows 電腦

將以下檔案傳輸到 Windows 電腦：

- `RMS-deployment.zip` - 專案程式碼
- `rms_db_dump.sql` - 資料庫備份 (SQL)
- 上傳檔案目錄 `public/uploads/` (如有)
- ISO 文件目錄 `public/iso_doc/` (如有)

**建議使用**：隨身碟、網路共享、雲端硬碟

---

## 第三部分：Windows 環境設置

### Step 5: 解壓縮並設置專案

**5.1 建立專案目錄**

```powershell
# 建立專案目錄
mkdir C:\RMS
cd C:\RMS

# 解壓縮專案
Expand-Archive -Path "C:\Downloads\RMS-deployment.zip" -DestinationPath "C:\RMS"
```

**5.2 設置環境變數**

建立 `.env` 檔案：

```powershell
# 建立 .env 檔案
@"
# PostgreSQL Connection
POSTGRES_PASSWORD=rms_secure_password
DATABASE_URL="postgresql://rms_user:rms_secure_password@postgres:5432/rms_db?schema=public"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="請替換為至少32個字符的隨機字串"
"@ | Out-File -FilePath ".env" -Encoding UTF8
```

> 💡 產生 NEXTAUTH_SECRET：
>
> ```powershell
> [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
> ```

**5.3 還原上傳檔案**

```powershell
# 還原上傳檔案
if (Test-Path "C:\Downloads\uploads") {
    Copy-Item -Recurse "C:\Downloads\uploads\*" "C:\RMS\public\uploads\"
}
if (Test-Path "C:\Downloads\iso_doc") {
    Copy-Item -Recurse "C:\Downloads\iso_doc\*" "C:\RMS\public\iso_doc\"
}
```

### Step 6: 設置 SSL 憑證

**選項 A：自簽憑證 (內部測試用)**

```powershell
# 確保 OpenSSL 已安裝
choco install openssl

# 建立 SSL 目錄
mkdir C:\RMS\nginx\ssl

# 產生自簽憑證
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout "C:\RMS\nginx\ssl\privkey.pem" `
    -out "C:\RMS\nginx\ssl\fullchain.pem" `
    -subj "/CN=localhost"
```

**選項 B：正式憑證 (Let's Encrypt)**

```powershell
# 安裝 Certbot
choco install certbot

# 取得憑證 (需先確保 80 埠可用)
certbot certonly --standalone -d your-domain.com

# 複製憑證
Copy-Item "C:\Certbot\live\your-domain.com\fullchain.pem" "C:\RMS\nginx\ssl\"
Copy-Item "C:\Certbot\live\your-domain.com\privkey.pem" "C:\RMS\nginx\ssl\"
```

---

## 第四部分：啟動服務

### Step 7: 構建 Docker 映像

```powershell
cd C:\RMS

# 構建映像 (首次需要約 5-10 分鐘)
docker compose build

# 檢查映像是否成功建立
docker images | Select-String "rms"
```

### Step 8: 啟動容器

```powershell
# 啟動所有服務
docker compose up -d

# 檢查容器狀態
docker compose ps

# 預期輸出：
# NAME              STATUS    PORTS
# rms-postgres      Up        5432/tcp
# rms-application   Up        0.0.0.0:3000->3000/tcp
# rms-nginx         Up        0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### Step 9: 初始化資料庫 (首次部署)

> 如果是還原 `rms_db_dump.sql`，則不需要執行 prisma migrate，直接匯入 SQL 即可。

**情況 A: 匯入舊資料庫**

```powershell
# 等待 PostgreSQL 啟動
Start-Sleep -Seconds 10

# 匯入 SQL
Get-Content "C:\Downloads\rms_db_dump.sql" | docker exec -i rms-postgres psql -U rms_user -d rms_db
```

**情況 B: 全新安裝**

```powershell
# 執行資料庫遷移
docker exec rms-application npx prisma migrate deploy
```

### Step 10: 設置 Windows 防火牆

```powershell
# 開放 HTTPS 埠 (443)
New-NetFirewallRule -DisplayName "RMS HTTPS" `
    -Direction Inbound -Port 443 -Protocol TCP -Action Allow

# 開放 HTTP 埠 (80) - 用於重導向
New-NetFirewallRule -DisplayName "RMS HTTP" `
    -Direction Inbound -Port 80 -Protocol TCP -Action Allow
```

---

## 第五部分：服務上線驗證

### Step 11: 基本連線測試

**11.1 本機測試**

```powershell
# 測試健康檢查 API
Invoke-RestMethod -Uri "http://localhost:3000/api/health"

# 預期回應：
# status    : ok
# timestamp : 2026-01-07T...
# database  : connected
```

**11.2 HTTPS 測試**

在瀏覽器開啟：

- `https://localhost` (本機測試)
- `https://your-domain.com` (正式網域)

### Step 12: 功能驗證

開啟瀏覽器，依序測試：

| 步驟 | 操作 | 預期結果 |
|------|------|----------|
| 1 | 訪問首頁 | 顯示登入頁面 |
| 2 | 登入管理員帳號 | 成功進入系統 |
| 3 | 檢視專案列表 | 顯示所有專案 |
| 4 | 開啟項目詳情 | 內容正確顯示 |
| 5 | 測試搜尋功能 | 搜尋結果正確 |
| 6 | 上傳測試檔案 | 上傳成功 |
| 7 | 下載已上傳檔案 | 下載正常 |
| 8 | 開啟審計日誌 (`/admin/audit`) | 顯示登入記錄 |
| 9 | 測試帳號鎖定 (連續5次錯誤密碼) | 顯示鎖定訊息 |

---

## 第六部分：設置自動備份

### Step 13: 配置備份排程

```powershell
# 建立備份目錄
mkdir C:\RMS-Backups

# 建立排程任務
$Action = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-File C:\RMS\scripts\backup.ps1 -BackupDir C:\RMS-Backups"

$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00"

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd

Register-ScheduledTask `
    -TaskName "RMS-DailyBackup" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "RMS 系統每日自動備份 (02:00)"

# 驗證排程任務
Get-ScheduledTask -TaskName "RMS-DailyBackup"
```

### Step 14: 手動執行備份測試

```powershell
# 執行備份腳本
C:\RMS\scripts\backup.ps1 -BackupDir "C:\RMS-Backups"

# 檢查備份檔案
Get-ChildItem C:\RMS-Backups
```

---

## 第七部分：維運指令參考

### 常用操作指令

```powershell
# ===== 服務管理 =====
docker compose up -d      # 啟動服務
docker compose down       # 停止服務
docker compose restart    # 重啟服務
docker compose logs -f    # 查看即時日誌

# ===== 容器狀態 =====
docker compose ps         # 查看容器狀態
docker stats              # 查看資源使用

# ===== 資料庫操作 =====
# 進入 PostgreSQL CLI
docker exec -it rms-postgres psql -U rms_user -d rms_db

# 備份資料庫
docker exec rms-postgres pg_dump -U rms_user -d rms_db > backup.sql

# ===== 更新部署 =====
git pull origin main                           # 拉取最新程式碼
docker compose build --no-cache                # 重新構建
docker compose up -d                           # 重啟服務
```

---

## 第八部分：檢驗作業規劃

詳細檢驗作業請參考 [deployment_checklist.md](deployment_checklist.md)

### 快速檢驗清單

**部署前檢驗：**

- [ ] Docker Desktop 已安裝並執行
- [ ] Git 已安裝
- [ ] 專案檔案已解壓縮
- [ ] .env 環境變數已設置
- [ ] SSL 憑證已配置
- [ ] 資料庫已匯入 (PostgreSQL)

**部署後檢驗：**

- [ ] 容器正常執行 (`docker compose ps`)
- [ ] 健康檢查通過 (`/api/health`)
- [ ] HTTPS 正常連線
- [ ] 使用者可登入
- [ ] 資料正確顯示
- [ ] 檔案上傳/下載正常
- [ ] 備份排程已設置

**每週檢驗：**

- [ ] 備份檔案存在且完整
- [ ] 磁碟空間充足
- [ ] 日誌無異常錯誤
- [ ] SSL 憑證未過期
- [ ] 審計日誌正常記錄

---

## 聯絡資訊

- **技術支援**：IT 部門
- **文件維護**：(待填寫)
- **緊急聯絡**：(待填寫)
