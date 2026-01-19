# Windows 11 主機部署指南

> 最後更新: 2026-01-15

本文件說明如何在 **Windows 11** 主機上部署 LLRWD-RMS 系統，不使用 Docker。

---

## 目錄

1. [部署架構概述](#1-部署架構概述)
2. [環境需求](#2-環境需求)
3. [安裝 Node.js](#3-安裝-nodejs)
4. [安裝 PostgreSQL](#4-安裝-postgresql)
5. [安裝 Git](#5-安裝-git)
6. [部署應用程式](#6-部署應用程式)
7. [設定環境變數](#7-設定環境變數)
8. [初始化資料庫](#8-初始化資料庫)
9. [Puppeteer 設定](#9-puppeteer-設定)
10. [啟動應用程式](#10-啟動應用程式)
11. [設定 Windows 服務](#11-設定-windows-服務)
12. [設定 IIS 反向代理](#12-設定-iis-反向代理-可選)
13. [防火牆設定](#13-防火牆設定)
14. [備份與維護](#14-備份與維護)
15. [常見問題排解](#15-常見問題排解)

---

## 1. 部署架構概述

```
┌─────────────────────────────────────────────────────────────┐
│                    Windows 11 主機                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   IIS       │  │  Next.js    │  │    PostgreSQL       │  │
│  │  (Port 80)  │→ │ (Port 3000) │→ │    (Port 5432)      │  │
│  │  (可選)     │  └─────────────┘  └─────────────────────┘  │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 環境需求

### 硬體需求

| 項目 | 最低需求 | 建議配置 |
|------|----------|----------|
| CPU | 2 Core | 4 Core |
| RAM | 4 GB | 8 GB |
| Storage | 50 GB SSD | 100 GB SSD |
| OS | Windows 11 | Windows 11 Pro |

### 軟體需求

| 軟體 | 版本 | 用途 |
|------|------|------|
| Node.js | 20.x LTS | JavaScript 執行環境 |
| PostgreSQL | 16.x | 資料庫 |
| Git | 最新版 | 版本控制 |
| Chrome/Chromium | 最新版 | PDF 生成 (Puppeteer) |

---

## 3. 安裝 Node.js

### 3.1 下載 Node.js

1. 訪問 [Node.js 官網](https://nodejs.org/)
2. 下載 **20.x LTS** 版本的 Windows Installer (.msi)
3. 或直接下載：<https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi>

### 3.2 執行安裝程式

1. 雙擊下載的 `.msi` 檔案
2. 按照安裝精靈進行：
   - 接受授權條款
   - 選擇安裝路徑（建議使用預設 `C:\Program Files\nodejs`）
   - 勾選 **Automatically install the necessary tools...**（可選）
3. 完成安裝

### 3.3 驗證安裝

開啟 **PowerShell** 或 **命令提示字元**：

```powershell
node --version
# 預期輸出: v20.11.1

npm --version
# 預期輸出: 10.x.x
```

### 3.4 設定 npm 全域路徑（可選）

```powershell
# 建立全域套件目錄
mkdir $env:USERPROFILE\npm-global

# 設定 npm 使用此目錄
npm config set prefix "$env:USERPROFILE\npm-global"

# 加入 PATH（需要以系統管理員執行）
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:USERPROFILE\npm-global", "User")
```

---

## 4. 安裝 PostgreSQL

### 4.1 下載 PostgreSQL

1. 訪問 [PostgreSQL 官網](https://www.postgresql.org/download/windows/)
2. 點擊 **Download the installer**
3. 選擇 **PostgreSQL 16.x** for **Windows x86-64**
4. 或直接下載：<https://www.enterprisedb.com/downloads/postgres-postgresql-downloads>

### 4.2 執行安裝程式

1. 以**系統管理員**身份執行安裝程式
2. 安裝設定：
   - 安裝路徑：`C:\Program Files\PostgreSQL\16`
   - 資料目錄：`C:\Program Files\PostgreSQL\16\data`
   - **設定 postgres 超級使用者密碼**（請記住此密碼）
   - 端口：`5432`（預設）
   - 語言環境：`Chinese (Traditional), Taiwan` 或 `Default locale`
3. 取消勾選 **Stack Builder**（不需要）
4. 完成安裝

### 4.3 驗證安裝

```powershell
# 檢查 PostgreSQL 服務狀態
Get-Service -Name "postgresql*"

# 預期輸出: postgresql-x64-16   Running
```

### 4.4 加入 PATH

將 PostgreSQL 的 `bin` 目錄加入 PATH：

```powershell
# 以系統管理員執行
[Environment]::SetEnvironmentVariable(
    "Path",
    $env:Path + ";C:\Program Files\PostgreSQL\16\bin",
    "Machine"
)

# 重新開啟 PowerShell 後驗證
psql --version
# 預期輸出: psql (PostgreSQL) 16.x
```

### 4.5 建立資料庫與使用者

開啟 **PowerShell**：

```powershell
# 以 postgres 使用者連線
psql -U postgres

# 輸入安裝時設定的密碼
```

在 psql 中執行：

```sql
-- 建立資料庫
CREATE DATABASE llrwd_rms;

-- 建立使用者
CREATE USER llrwd_user WITH ENCRYPTED PASSWORD 'YourStrongPassword123!';

-- 授予權限
GRANT ALL PRIVILEGES ON DATABASE llrwd_rms TO llrwd_user;

-- 連線到資料庫並授予 schema 權限
\c llrwd_rms
GRANT ALL ON SCHEMA public TO llrwd_user;

-- 離開
\q
```

---

## 5. 安裝 Git

### 5.1 下載 Git

1. 訪問 [Git 官網](https://git-scm.com/download/win)
2. 下載 **64-bit Git for Windows Setup**

### 5.2 執行安裝程式

1. 執行安裝程式
2. 建議設定：
   - 預設編輯器：選擇您習慣的編輯器（如 VS Code）
   - PATH 環境：選擇 **Git from the command line and also from 3rd-party software**
   - HTTPS 傳輸：使用 **OpenSSL**
   - 換行符號：選擇 **Checkout as-is, commit Unix-style line endings**
3. 完成安裝

### 5.3 驗證安裝

```powershell
git --version
# 預期輸出: git version 2.x.x
```

---

## 6. 部署應用程式

### 6.1 建立應用程式目錄

```powershell
# 建立目錄
mkdir C:\Apps\llrwd-rms
cd C:\Apps\llrwd-rms
```

### 6.2 方法一：使用 Git Clone

```powershell
git clone <your-repo-url> .
```

### 6.3 方法二：手動複製檔案

將專案檔案複製到 `C:\Apps\llrwd-rms` 目錄。

### 6.4 安裝依賴套件

```powershell
cd C:\Apps\llrwd-rms
npm install
```

### 6.5 建置專案

```powershell
npm run build
```

---

## 7. 設定環境變數

### 7.1 建立 .env 檔案

在 `C:\Apps\llrwd-rms` 目錄建立 `.env` 檔案：

```powershell
notepad C:\Apps\llrwd-rms\.env
```

寫入以下內容：

```env
# 資料庫連線
DATABASE_URL="postgresql://llrwd_user:YourStrongPassword123!@localhost:5432/llrwd_rms"

# NextAuth 設定
NEXTAUTH_SECRET="your-super-secret-key-at-least-32-characters-long"
NEXTAUTH_URL="http://localhost:3000"

# Node 環境
NODE_ENV=production

# Puppeteer 設定 (使用 Chrome)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
# 如果要使用已安裝的 Chrome，設定以下路徑
# PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### 7.2 產生 NEXTAUTH_SECRET

```powershell
# 使用 Node.js 產生隨機金鑰
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 7.3 設定系統環境變數（可選）

如果要設定為系統層級的環境變數：

```powershell
# 以系統管理員執行
[Environment]::SetEnvironmentVariable("DATABASE_URL", "postgresql://llrwd_user:YourStrongPassword123!@localhost:5432/llrwd_rms", "Machine")
[Environment]::SetEnvironmentVariable("NEXTAUTH_SECRET", "your-secret-key", "Machine")
[Environment]::SetEnvironmentVariable("NEXTAUTH_URL", "http://localhost:3000", "Machine")
[Environment]::SetEnvironmentVariable("NODE_ENV", "production", "Machine")
```

---

## 8. 初始化資料庫

### 8.1 執行 Prisma 遷移

```powershell
cd C:\Apps\llrwd-rms

# 推送資料庫結構
npx prisma db push

# 執行種子資料（建立預設管理員）
npx prisma db seed
```

### 8.2 驗證資料庫

```powershell
# 連線到資料庫
psql -U llrwd_user -d llrwd_rms -h localhost

# 查看資料表
\dt

# 離開
\q
```

---

## 9. Puppeteer 設定

### 9.1 方法一：使用 Puppeteer 內建 Chrome

Puppeteer 會在 `npm install` 時自動下載 Chrome。無需額外設定。

### 9.2 方法二：使用系統已安裝的 Chrome

如果要使用系統已安裝的 Chrome：

1. 確認 Chrome 已安裝
2. 在 `.env` 檔案中設定路徑：

```env
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### 9.3 安裝中文字型

Windows 預設已有中文字型支援。如需額外字型：

1. 下載 [Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC)
2. 解壓縮後，右鍵點擊字型檔案 → **安裝**

---

## 10. 啟動應用程式

### 10.1 測試啟動

```powershell
cd C:\Apps\llrwd-rms
npm start
```

開啟瀏覽器訪問 `http://localhost:3000` 測試。

### 10.2 使用 PM2 管理（建議）

#### 安裝 PM2

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

#### 設定 PM2 開機啟動

```powershell
pm2-startup install
```

#### 啟動應用程式

```powershell
cd C:\Apps\llrwd-rms
pm2 start npm --name "llrwd-rms" -- start
```

#### 儲存 PM2 程序列表

```powershell
pm2 save
```

#### PM2 常用指令

```powershell
# 查看狀態
pm2 status

# 查看日誌
pm2 logs llrwd-rms

# 重啟
pm2 restart llrwd-rms

# 停止
pm2 stop llrwd-rms

# 刪除
pm2 delete llrwd-rms
```

---

## 11. 設定 Windows 服務

如果不使用 PM2，可以使用 NSSM 將 Node.js 應用程式設定為 Windows 服務。

### 11.1 下載 NSSM

1. 訪問 [NSSM 官網](https://nssm.cc/download)
2. 下載最新版本
3. 解壓縮到 `C:\Tools\nssm`

### 11.2 建立服務

以**系統管理員**開啟 PowerShell：

```powershell
# 進入 NSSM 目錄
cd C:\Tools\nssm\win64

# 安裝服務
.\nssm.exe install LLRWD-RMS
```

在 NSSM GUI 中設定：

| 設定項目 | 值 |
|----------|-----|
| Path | `C:\Program Files\nodejs\node.exe` |
| Startup directory | `C:\Apps\llrwd-rms` |
| Arguments | `C:\Apps\llrwd-rms\node_modules\.bin\next start` |

切換到 **Environment** 標籤，加入環境變數：

```
NODE_ENV=production
DATABASE_URL=postgresql://llrwd_user:YourStrongPassword123!@localhost:5432/llrwd_rms
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

### 11.3 啟動服務

```powershell
.\nssm.exe start LLRWD-RMS
```

### 11.4 管理服務

```powershell
# 查看狀態
.\nssm.exe status LLRWD-RMS

# 停止
.\nssm.exe stop LLRWD-RMS

# 重啟
.\nssm.exe restart LLRWD-RMS

# 移除
.\nssm.exe remove LLRWD-RMS confirm
```

---

## 12. 設定 IIS 反向代理 (可選)

如果需要使用 IIS 作為反向代理（使用 80/443 端口）。

### 12.1 安裝 IIS

1. 開啟 **控制台** → **程式和功能** → **開啟或關閉 Windows 功能**
2. 勾選：
   - **Internet Information Services**
   - **Web 管理工具** → **IIS 管理主控台**
   - **World Wide Web 服務** → **應用程式開發功能** → **ISAPI 擴充程式**、**ISAPI 篩選器**

### 12.2 安裝 URL Rewrite 和 ARR

1. 下載 [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
2. 下載 [Application Request Routing (ARR)](https://www.iis.net/downloads/microsoft/application-request-routing)
3. 安裝兩個模組

### 12.3 啟用 ARR Proxy

1. 開啟 **IIS 管理員**
2. 點擊伺服器節點
3. 雙擊 **Application Request Routing Cache**
4. 點擊右側 **Server Proxy Settings**
5. 勾選 **Enable proxy**
6. 點擊 **Apply**

### 12.4 建立網站

1. 在 IIS 管理員中，右鍵點擊 **站台** → **新增網站**
2. 設定：
   - 站台名稱：`LLRWD-RMS`
   - 實體路徑：`C:\inetpub\wwwroot\llrwd-rms`（建立空目錄）
   - 繫結：`http`，端口 `80`

### 12.5 設定 URL Rewrite

在 `C:\inetpub\wwwroot\llrwd-rms` 建立 `web.config`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="ReverseProxyInboundRule" stopProcessing="true">
                    <match url="(.*)" />
                    <action type="Rewrite" url="http://localhost:3000/{R:1}" />
                </rule>
            </rules>
        </rewrite>
    </system.webServer>
</configuration>
```

### 12.6 重啟 IIS

```powershell
iisreset
```

---

## 13. 防火牆設定

### 13.1 開放端口

以**系統管理員**開啟 PowerShell：

```powershell
# 開放 3000 端口（應用程式）
New-NetFirewallRule -DisplayName "LLRWD-RMS" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow

# 如果使用 IIS，開放 80 端口
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Port 80 -Protocol TCP -Action Allow

# 開放 443 端口（HTTPS）
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Port 443 -Protocol TCP -Action Allow
```

### 13.2 限制特定 IP 存取（可選）

```powershell
# 僅允許特定網段存取
New-NetFirewallRule -DisplayName "LLRWD-RMS Internal" `
    -Direction Inbound `
    -Port 3000 `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress 192.168.1.0/24
```

---

## 14. 備份與維護

### 14.1 備份資料庫

建立備份腳本 `C:\Apps\llrwd-rms\scripts\backup.ps1`：

```powershell
# backup.ps1

$BackupDir = "C:\Backups\llrwd-rms"
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$RetentionDays = 30

# 建立備份目錄
New-Item -ItemType Directory -Force -Path $BackupDir

# 設定 PostgreSQL 密碼
$env:PGPASSWORD = "YourStrongPassword123!"

# 備份資料庫
pg_dump -U llrwd_user -h localhost llrwd_rms | Out-File "$BackupDir\db_$Date.sql" -Encoding UTF8

# 備份上傳檔案
Compress-Archive -Path "C:\Apps\llrwd-rms\public\uploads" -DestinationPath "$BackupDir\uploads_$Date.zip" -Force
Compress-Archive -Path "C:\Apps\llrwd-rms\public\iso-docs" -DestinationPath "$BackupDir\iso-docs_$Date.zip" -Force

# 清理舊備份
Get-ChildItem $BackupDir -Recurse | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays)
} | Remove-Item -Force

Write-Host "備份完成: $Date"
```

### 14.2 設定排程工作

使用**工作排程器**設定每日備份：

```powershell
# 建立排程工作（每日凌晨 2 點執行）
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Apps\llrwd-rms\scripts\backup.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "LLRWD-RMS Backup" -Action $Action -Trigger $Trigger -Principal $Principal
```

### 14.3 還原備份

```powershell
# 還原資料庫
$env:PGPASSWORD = "YourStrongPassword123!"
psql -U llrwd_user -h localhost -d llrwd_rms -f "C:\Backups\llrwd-rms\db_YYYYMMDD.sql"

# 還原檔案
Expand-Archive -Path "C:\Backups\llrwd-rms\uploads_YYYYMMDD.zip" -DestinationPath "C:\Apps\llrwd-rms\public\" -Force
```

### 14.4 查看日誌

```powershell
# PM2 日誌
pm2 logs llrwd-rms

# 或查看 PM2 日誌檔案
Get-Content "$env:USERPROFILE\.pm2\logs\llrwd-rms-out.log" -Tail 100
Get-Content "$env:USERPROFILE\.pm2\logs\llrwd-rms-error.log" -Tail 100
```

---

## 15. 常見問題排解

### Q1: npm install 失敗

**原因**: 網路問題或權限問題

**解決**:

```powershell
# 清除快取
npm cache clean --force

# 使用系統管理員權限重試
# 或設定 npm 映射
npm config set registry https://registry.npmmirror.com
```

### Q2: PostgreSQL 連線失敗

**原因**: 服務未啟動或認證問題

**解決**:

```powershell
# 檢查服務狀態
Get-Service -Name "postgresql*"

# 啟動服務
Start-Service -Name "postgresql-x64-16"

# 檢查 pg_hba.conf
notepad "C:\Program Files\PostgreSQL\16\data\pg_hba.conf"

# 確保有以下行
# host    all    all    127.0.0.1/32    scram-sha-256
```

### Q3: Puppeteer 執行錯誤

**原因**: Chrome 未安裝或路徑錯誤

**解決**:

```powershell
# 確認 Chrome 路徑
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"

# 或讓 Puppeteer 自動下載
# 在 .env 中移除 PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
# 然後重新安裝
npm uninstall puppeteer
npm install puppeteer
```

### Q4: 端口 3000 被佔用

**原因**: 其他程式使用此端口

**解決**:

```powershell
# 查看佔用 3000 端口的程式
netstat -ano | findstr :3000

# 終止程式（PID 從上一步取得）
Stop-Process -Id <PID> -Force

# 或修改應用程式端口
# 在 package.json 的 start script 加入 -p 參數
# "start": "next start -p 3001"
```

### Q5: PM2 開機不自動啟動

**原因**: Windows 服務未正確設定

**解決**:

```powershell
# 重新設定 PM2 啟動
pm2-startup install
pm2 save

# 或使用 NSSM 設定為 Windows 服務
```

### Q6: 中文 PDF 顯示亂碼

**原因**: 缺少中文字型

**解決**:

1. 下載並安裝 [Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC)
2. 重啟應用程式

---

## 版本對照表

| 軟體 | 建議版本 | 下載連結 |
|------|----------|----------|
| Node.js | 20.11.x LTS | [下載](https://nodejs.org/) |
| npm | 10.x | 隨 Node.js 安裝 |
| PostgreSQL | 16.x | [下載](https://www.postgresql.org/download/windows/) |
| Git | 最新版 | [下載](https://git-scm.com/download/win) |
| PM2 | 最新版 | `npm install -g pm2` |
| NSSM | 最新版 | [下載](https://nssm.cc/download) |

---

## 快速檢查清單

### 安裝前

- [ ] Windows 11 已安裝並更新
- [ ] 擁有系統管理員權限
- [ ] 確認硬碟空間足夠（至少 10GB）

### 安裝後

- [ ] Node.js 版本正確 (`node -v`)
- [ ] npm 可正常使用 (`npm -v`)
- [ ] PostgreSQL 服務運行中
- [ ] 資料庫已建立 (`llrwd_rms`)
- [ ] 環境變數已設定 (`.env`)
- [ ] 應用程式已建置 (`npm run build`)
- [ ] 應用程式可正常啟動 (`npm start`)
- [ ] 可以正常登入系統
- [ ] PDF 生成功能正常
- [ ] 備份排程已設定

### 進階設定

- [ ] PM2 或 NSSM 服務已設定
- [ ] 開機自動啟動已設定
- [ ] 防火牆規則已設定
- [ ] IIS 反向代理已設定（如需要）

---

## 更新應用程式

```powershell
cd C:\Apps\llrwd-rms

# 停止服務
pm2 stop llrwd-rms

# 拉取最新程式碼
git pull

# 安裝新依賴
npm install

# 重新建置
npm run build

# 執行資料庫遷移
npx prisma db push

# 重新啟動
pm2 start llrwd-rms
```
