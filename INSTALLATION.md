# RMS 系統安裝指南 (Miniforge 環境)

> **版本**: 2.1  
> **日期**: 2026-05-25  
> **適用對象**: Windows/macOS/Linux 環境，使用 Miniforge 建立隔離開發環境

---

## 系統需求

| 項目 | 最低需求 | 建議配置 |
|------|----------|----------|
| 作業系統 | Windows 10+ / macOS 12+ / Ubuntu 22.04+ | 最新版本 |
| RAM | 8 GB | 16 GB |
| 硬碟空間 | 10 GB | 30 GB (SSD) |
| CPU | 4 核心 | 8 核心 |
| 網路 | 可連線至 npm / PostgreSQL | 固定 IP (內網存取) |

---

## 目錄

1. [安裝 Miniforge](#1-安裝-miniforge)
2. [建立 Conda 環境](#2-建立-conda-環境)
3. [安裝 PostgreSQL](#3-安裝-postgresql)
4. [設定專案](#4-設定專案)
5. [初始化資料庫](#5-初始化資料庫)
6. [啟動系統](#6-啟動系統)
7. [生產部署](#7-生產部署)
8. [備份與排程](#8-備份與排程)
9. [故障排除](#9-故障排除)

---

## 核心技術棧

| 類別 | 技術 | 說明 |
|------|------|------|
| 框架 | Next.js 15 | App Router 前後端整合 |
| 前端 | React 19 | UI 框架 |
| 語言 | TypeScript 5 | 型別安全開發 |
| 資料庫 | PostgreSQL 15+ | 主資料庫 |
| ORM | Prisma 5.22 | 資料庫架構管理 |
| 認證 | NextAuth.js 4 | 使用者身份驗證 |
| 編輯器 | Tiptap 3 | 富文本編輯器 |
| PDF | pdf-lib | PDF 生成與簽章 (純 JavaScript) |
| 備份 | adm-zip / archiver / unzipper | 系統與專案備份還原 |
| 測試 | Vitest | 單元測試框架 |

> 💡 **注意**: 系統已改用純 `pdf-lib` 生成 PDF，**不再依賴 Puppeteer/Chromium**。

---

## 1. 安裝 Miniforge

### Windows

```powershell
# 下載 Miniforge 安裝程式
Invoke-WebRequest -Uri "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Windows-x86_64.exe" -OutFile "$env:TEMP\Miniforge3.exe"

# 執行安裝 (靜默模式，安裝至預設路徑)
Start-Process -Wait -FilePath "$env:TEMP\Miniforge3.exe" -ArgumentList "/S", "/RegisterPython=1"

# 重新開啟終端機以載入 conda
```

手動安裝：下載 [Miniforge3-Windows-x86_64.exe](https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Windows-x86_64.exe) 並執行。

### macOS

```bash
# 使用 Homebrew 安裝
brew install miniforge

# 初始化 conda (zsh)
conda init zsh

# 重新開啟終端機
```

或手動安裝：

```bash
curl -L -O "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-MacOSX-$(uname -m).sh"
bash Miniforge3-MacOSX-$(uname -m).sh -b
~/miniforge3/bin/conda init zsh
```

### Linux

```bash
curl -L -O "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh"
bash Miniforge3-Linux-x86_64.sh -b
~/miniforge3/bin/conda init bash
source ~/.bashrc
```

---

## 2. 建立 Conda 環境

```bash
# 建立 RMS 專用環境 (Node.js 20)
conda create -n rms nodejs=20 -y

# 啟用環境
conda activate rms

# 驗證安裝
node --version    # 應顯示 v20.x.x
npm --version     # 應顯示 10.x.x
```

> 💡 **提示**: 每次開啟終端機時，需執行 `conda activate rms` 啟用環境。

---

## 3. 安裝 PostgreSQL

### 方法 A: 使用 Conda 安裝 (推薦開發環境)

```bash
# 在 rms 環境中安裝 PostgreSQL
conda activate rms
conda install postgresql=16 -y

# 初始化資料庫叢集
initdb -D ~/postgres_data

# 啟動 PostgreSQL 服務
pg_ctl -D ~/postgres_data -l ~/postgres_data/logfile start

# 建立資料庫與使用者
createdb rms_db
psql -d rms_db -c "CREATE USER rms_user WITH PASSWORD 'rms_password';"
psql -d rms_db -c "GRANT ALL PRIVILEGES ON DATABASE rms_db TO rms_user;"
psql -d rms_db -c "GRANT ALL PRIVILEGES ON SCHEMA public TO rms_user;"

# 驗證連線
psql -U rms_user -d rms_db -c "SELECT version();"
```

### 方法 B: 系統安裝 PostgreSQL

#### Windows

```powershell
# 下載並安裝 PostgreSQL
# https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

# 安裝後，使用 pgAdmin 或 psql 建立資料庫
# 1. 建立資料庫: rms_db
# 2. 建立使用者: rms_user (密碼自訂)
# 3. 授予權限
```

#### macOS

```bash
# 使用 Homebrew 安裝
brew install postgresql@16
brew services start postgresql@16

# 建立資料庫與使用者
createdb rms_db
psql -d rms_db -c "CREATE USER rms_user WITH PASSWORD 'rms_password';"
psql -d rms_db -c "GRANT ALL PRIVILEGES ON DATABASE rms_db TO rms_user;"
psql -d rms_db -c "GRANT ALL PRIVILEGES ON SCHEMA public TO rms_user;"
```

#### Linux (Ubuntu/Debian)

```bash
# 安裝 PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib -y

# 啟動服務
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 建立資料庫與使用者
sudo -u postgres psql -c "CREATE DATABASE rms_db;"
sudo -u postgres psql -c "CREATE USER rms_user WITH PASSWORD 'rms_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rms_db TO rms_user;"
sudo -u postgres psql -d rms_db -c "GRANT ALL PRIVILEGES ON SCHEMA public TO rms_user;"
```

---

## 4. 設定專案

### 4.1 取得專案

```bash
# Clone 專案
git clone https://github.com/YOUR_USERNAME/RMS.git
cd RMS

# 或從 ZIP 解壓縮
unzip RMS-project.zip -d RMS
cd RMS
```

### 4.2 安裝依賴套件

```bash
# 確保在 rms 環境中
conda activate rms

# 安裝 npm 套件
npm install
```

### 4.3 設定環境變數

建立 `.env` 檔案：

```bash
# 複製範本
cp .env.example .env
```

編輯 `.env` 內容（需與步驟 3 建立的 PostgreSQL 使用者密碼一致）：

```env
# PostgreSQL Database
DATABASE_URL="postgresql://rms_user:rms_password@localhost:5432/rms_db?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Admin Seed Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=           # 必填，至少 12 字元，需包含大小寫字母與數字

# Docker PostgreSQL Password (Docker 部署時使用)
POSTGRES_PASSWORD="rms_secure_password"

# Environment
NODE_ENV="development"
```

> 💡 **建議**: 使用以下指令產生安全的密鑰：
>
> ```bash
> # 產生 NEXTAUTH_SECRET
> openssl rand -base64 32
>
> # 產生安全的管理員密碼 (至少 12 字元)
> openssl rand -base64 16
> ```

---

## 5. 初始化資料庫

```bash
# 確保 PostgreSQL 服務已啟動
# Conda 安裝: pg_ctl -D ~/postgres_data status
# 系統安裝: sudo systemctl status postgresql

# 產生 Prisma Client
npx prisma generate

# 執行資料庫遷移 (建立所有資料表)
npx prisma db push

# 設定管理員密碼 (必填，至少 12 字元，含大小寫與數字)
export ADMIN_PASSWORD="YourStr0ngP@ssword"

# 建立管理員帳號 (帳號預設為 admin，可透過 ADMIN_USERNAME 環境變數自訂)
npx prisma db seed
```

> ⚠️ **重要**:
>
> - `ADMIN_PASSWORD` 為必填環境變數，未設定或密碼強度不足時 seed 會拒絕執行
> - 密碼需至少 12 字元，且包含大寫字母、小寫字母與數字
> - 可在 `.env` 檔案中設定，或如上方範例透過環境變數傳入
> - 帳號預設為 `admin`，可透過 `ADMIN_USERNAME` 環境變數自訂

---

## 6. 啟動系統

### 開發模式

```bash
conda activate rms
npm run dev
```

開啟瀏覽器：<http://localhost:3000>

### 生產模式

```bash
# 建置專案
npm run build

# 啟動生產伺服器
npm start
```

---

## 7. 生產部署

### 7.1 使用 PM2 管理程序

```bash
# 安裝 PM2
npm install -g pm2

# 啟動應用程式
pm2 start npm --name "rms" -- start

# 設定開機自動啟動
pm2 startup
pm2 save

# 常用指令
pm2 status          # 查看狀態
pm2 logs rms        # 查看日誌
pm2 restart rms     # 重新啟動
pm2 stop rms        # 停止
```

### 7.2 使用 Nginx 反向代理 (選擇性)

安裝 Nginx：

```bash
# macOS
brew install nginx

# Ubuntu/Debian
sudo apt install nginx -y
```

建立設定檔 `/etc/nginx/sites-available/rms`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

啟用設定：

```bash
sudo ln -s /etc/nginx/sites-available/rms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7.3 設定 HTTPS (Let's Encrypt)

```bash
# 安裝 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 取得憑證
sudo certbot --nginx -d your-domain.com
```

---

## 8. 備份與排程

### 8.1 資料庫備份

```bash
# 手動備份
pg_dump -U rms_user -d rms_db > backup_$(date +%Y%m%d).sql

# 還原備份
psql -U rms_user -d rms_db < backup_20260120.sql
```

### 8.2 系統管理介面備份

系統提供完整的管理介面備份功能：

1. 登入系統管理後台
2. 前往「系統管理」→「備份與復原」
3. 可下載：
   - **資料庫備份** (SQL 格式)
   - **上傳檔案備份** (ZIP 格式)
   - **ISO 文件備份** (ZIP 格式)

### 8.3 自動備份排程 (cron)

```bash
# 編輯 crontab
crontab -e

# 新增每週日凌晨 2:00 備份
0 2 * * 0 pg_dump -U rms_user -d rms_db > /path/to/backups/rms_$(date +\%Y\%m\%d).sql
```

---

## 9. 故障排除

| 問題 | 解決方案 |
|------|----------|
| `conda: command not found` | 重新開啟終端機，或手動執行 `source ~/miniforge3/bin/activate` |
| `node: command not found` | 確認已執行 `conda activate rms` |
| PostgreSQL 連線失敗 | 確認服務已啟動：`pg_ctl -D ~/postgres_data status` |
| `prisma migrate` 失敗 | 檢查 `.env` 中的 `DATABASE_URL` 是否正確 |
| `prisma db seed` 拒絕執行 | 確認已設定 `ADMIN_PASSWORD` 環境變數，且密碼符合強度要求 (12+ 字元、含大小寫與數字) |
| Port 3000 已被佔用 | 執行 `lsof -i :3000` 找出佔用程序並終止 |
| npm install 失敗 | 刪除 `node_modules` 與 `package-lock.json` 後重試 |
| CSP 錯誤 (Console 報錯) | 若使用外部 CDN/字型，需在 `next.config.mjs` 的 CSP 標頭中加入對應來源 |

### PostgreSQL 服務管理

```bash
# Conda 安裝
pg_ctl -D ~/postgres_data start   # 啟動
pg_ctl -D ~/postgres_data stop    # 停止
pg_ctl -D ~/postgres_data status  # 狀態

# 系統安裝 (Linux)
sudo systemctl start postgresql
sudo systemctl stop postgresql
sudo systemctl status postgresql

# macOS (Homebrew)
brew services start postgresql@16
brew services stop postgresql@16
```

---

## 常用指令速查

| 操作 | 指令 |
|------|------|
| 啟用環境 | `conda activate rms` |
| 開發模式 | `npm run dev` |
| 生產建置 | `npm run build && npm start` |
| TypeScript 檢查 | `npx tsc --noEmit` |
| ESLint 檢查 | `npm run lint` |
| 執行測試 | `npx vitest run` |
| 執行單一測試 | `npx vitest run path/to/test` |
| 資料庫 GUI | `npx prisma studio` |
| 更新 Schema | `npx prisma db push` |
| 建立遷移 | `npx prisma migrate dev --name <name>` |
| 套用遷移 (正式) | `npx prisma migrate deploy` |
| 重設資料庫 | `npx prisma db push --force-reset` |
| 備份資料庫 | `pg_dump -U rms_user -d rms_db > backup.sql` |
| 還原資料庫 | `psql -U rms_user -d rms_db < backup.sql` |

---

## 安全注意事項

1. **管理員密碼**: 絕不使用預設或弱密碼，所有環境（含開發環境）皆須透過環境變數設定強密碼
2. **安全標頭**: 系統已內建 CSP、X-Frame-Options、X-Content-Type-Options 等安全標頭，若使用 CDN 或外部資源需調整 CSP 設定
3. **帳號鎖定**: 連續 5 次登入失敗將鎖定帳號 15 分鐘，管理員可從後台解鎖
4. **檔案上傳**: 系統會驗證 MIME 類型、副檔名一致性，拒絕不匹配的上傳
5. **備份還原**: 還原功能限 ADMIN 角色使用，且有 500MB 檔案大小上限

---

## 相關文件

- [README.md](README.md) - 專案概述與功能說明
- [docs/tech.md](docs/tech.md) - 技術文件與套件清單
- [docs/deployment_guide.md](docs/deployment_guide.md) - 進階部署規劃
- [docs/deployment_steps.md](docs/deployment_steps.md) - Step-by-Step 部署指南
- [docs/security-performance-code-review-2026-05-25.md](docs/security-performance-code-review-2026-05-25.md) - 資安與效能審查報告
- [docs/security-performance-fix-followup-2026-05-25.md](docs/security-performance-fix-followup-2026-05-25.md) - 修復後續步驟與驗證清單
