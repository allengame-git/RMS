# 離線 Linux 主機部署指南 (Air-Gapped Installation)

> 最後更新: 2026-01-15

本文件說明如何在**無法對外連線的內部網路 Linux 主機**上部署 LLRWD-RMS 系統。

---

## 目錄

1. [部署架構概述](#1-部署架構概述)
2. [準備工作清單](#2-準備工作清單)
3. [在線上主機下載檔案](#3-在線上主機下載檔案)
4. [檔案傳輸至離線主機](#4-檔案傳輸至離線主機)
5. [離線主機安裝流程](#5-離線主機安裝流程)
6. [應用程式部署](#6-應用程式部署)
7. [系統服務設定](#7-系統服務設定)
8. [Nginx 反向代理設定](#8-nginx-反向代理設定)
9. [防火牆設定](#9-防火牆設定)
10. [驗證與測試](#10-驗證與測試)
11. [維護與備份](#11-維護與備份)
12. [常見問題排解](#12-常見問題排解)

---

## 1. 部署架構概述

```
┌─────────────────────────────────────────────────────────────┐
│                    離線 Linux 主機                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Nginx     │  │  Next.js    │  │    PostgreSQL       │  │
│  │  (Port 80)  │→ │ (Port 3000) │→ │    (Port 5432)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 建議系統規格

| 項目 | 最低需求 | 建議配置 |
|------|----------|----------|
| CPU | 2 Core | 4 Core |
| RAM | 4 GB | 8 GB |
| Storage | 50 GB | 100 GB |
| OS | Debian 10 (buster) | Debian 10 (buster) |

---

## 2. 準備工作清單

### 需要下載的檔案清單

在可連網的電腦上，需要下載以下檔案：

| 檔案類別 | 說明 | 預估大小 |
|----------|------|----------|
| Node.js | v20.x LTS 二進位檔 | ~30 MB |
| PostgreSQL | 資料庫安裝包 | ~50 MB |
| Chromium | Puppeteer 瀏覽器 | ~150 MB |
| 中文字型 | Noto CJK 字型 | ~20 MB |
| Nginx | 反向代理伺服器 | ~5 MB |
| 應用程式原始碼 | 專案檔案 | ~10 MB |
| npm 套件 | node_modules 打包 | ~500 MB |

**總計約需 800 MB - 1 GB 空間**

### 準備目錄結構

```
offline_packages/
├── nodejs/
│   └── node-v20.x.x-linux-x64.tar.xz
├── postgresql/
│   └── postgresql-16-*.deb (多個檔案)
├── chromium/
│   └── chromium-browser_*.deb
├── fonts/
│   └── fonts-noto-cjk_*.deb
├── nginx/
│   └── nginx_*.deb
├── app/
│   ├── llrwd-rms.tar.gz (應用程式原始碼)
│   └── node_modules.tar.gz (npm 套件)
└── scripts/
    └── install.sh
```

---

## 3. 在線上主機下載檔案

> ⚠️ 以下步驟在**可連網的 Windows 或 macOS 電腦**上執行

---

### 3.1 建立下載目錄

#### Windows (PowerShell)

```powershell
# 建立下載目錄結構
$baseDir = "$env:USERPROFILE\Desktop\offline_packages"
New-Item -ItemType Directory -Force -Path "$baseDir\nodejs"
New-Item -ItemType Directory -Force -Path "$baseDir\postgresql"
New-Item -ItemType Directory -Force -Path "$baseDir\chromium"
New-Item -ItemType Directory -Force -Path "$baseDir\fonts"
New-Item -ItemType Directory -Force -Path "$baseDir\nginx"
New-Item -ItemType Directory -Force -Path "$baseDir\app"
New-Item -ItemType Directory -Force -Path "$baseDir\scripts"

cd $baseDir
```

#### macOS (Terminal)

```bash
# 建立下載目錄結構
mkdir -p ~/Desktop/offline_packages/{nodejs,postgresql,chromium,fonts,nginx,app,scripts}
cd ~/Desktop/offline_packages
```

---

### 3.2 下載 Node.js (Linux x64 版本)

> 📥 下載網址：<https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz>

#### Windows (PowerShell)

```powershell
cd "$env:USERPROFILE\Desktop\offline_packages\nodejs"

# 使用 Invoke-WebRequest 下載
Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz" -OutFile "node-v20.11.1-linux-x64.tar.xz"

# 或使用 curl (Windows 10+)
curl -o node-v20.11.1-linux-x64.tar.xz https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz
```

#### macOS (Terminal)

```bash
cd ~/Desktop/offline_packages/nodejs

# 使用 curl 下載
curl -O https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz

# 或使用 wget (需先安裝: brew install wget)
wget https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.xz
```

---

### 3.3 下載 PostgreSQL (Debian 10 buster 適用)

> 📥 PostgreSQL 需要多個 .deb 套件，建議使用瀏覽器手動下載

#### 方法一：手動下載 (Windows / macOS 通用)

訪問以下網址，下載 Debian 10 (buster) 適用的套件：

1. **PostgreSQL 16 主程式**
   - <https://apt.postgresql.org/pub/repos/apt/pool/main/p/postgresql-16/>

2. **PostgreSQL Common**
   - <https://apt.postgresql.org/pub/repos/apt/pool/main/p/postgresql-common/>

需要下載的檔案（選擇 `buster` 版本）：

- `postgresql-16_16.x-1.pgdg100+1_amd64.deb`
- `postgresql-client-16_16.x-1.pgdg100+1_amd64.deb`
- `postgresql-common_xxx.pgdg100+1_all.deb`
- `libpq5_16.x-1.pgdg100+1_amd64.deb`

> 📝 **說明**: `pgdg100` 表示 Debian 10 (buster) 版本

將下載的檔案放入 `offline_packages/postgresql/` 目錄。

#### 方法二：使用 Docker 下載套件 (進階)

如果熟悉 Docker，可在本機執行 Debian 10 容器來下載套件：

**Windows (PowerShell)**

```powershell
docker run -it --rm -v ${PWD}/postgresql:/packages debian:buster bash
```

**macOS (Terminal)**

```bash
docker run -it --rm -v $(pwd)/postgresql:/packages debian:buster bash
```

**容器內執行：**

```bash
apt-get update
apt-get install -y wget gnupg2 lsb-release

# 加入 PostgreSQL 官方源
echo "deb http://apt.postgresql.org/pub/repos/apt buster-pgdg main" > /etc/apt/sources.list.d/pgdg.list
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt-get update

# 下載套件 (不安裝)
cd /packages
apt-get download postgresql-16 postgresql-client-16 postgresql-common libpq5

# 下載相依套件
apt-cache depends postgresql-16 | grep Depends | awk '{print $2}' | xargs apt-get download 2>/dev/null || true

# 離開容器
exit
```

---

### 3.4 下載 Chromium (Debian 10 buster 適用)

> 📥 Chromium 有眾多相依套件，建議使用 Docker 方式下載完整套件

#### 方法一：手動下載核心套件

訪問 Debian Packages 網站下載：

- <https://packages.debian.org/buster/amd64/chromium/download>

> ⚠️ **注意**: Debian 10 的套件名稱是 `chromium`，不是 `chromium-browser`

將 `.deb` 檔案放入 `offline_packages/chromium/` 目錄。

#### 方法二：使用 Docker 下載完整套件 (建議)

**Windows (PowerShell)**

```powershell
docker run -it --rm -v ${PWD}/chromium:/packages debian:buster bash
```

**macOS (Terminal)**

```bash
docker run -it --rm -v $(pwd)/chromium:/packages debian:buster bash
```

**容器內執行：**

```bash
apt-get update

# 下載 Chromium 及所有相依套件
cd /packages
apt-get download chromium

# 取得相依套件清單並下載
apt-cache depends chromium | grep Depends | awk '{print $2}' | xargs apt-get download 2>/dev/null || true

# 下載常見相依
apt-get download libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libasound2 2>/dev/null || true

exit
```

---

### 3.5 下載中文字型

> 📥 Noto CJK 字型下載

#### 手動下載 (Windows / macOS 通用)

訪問 Debian Packages 下載：

- <https://packages.debian.org/buster/all/fonts-noto-cjk/download>
- <https://packages.debian.org/buster/all/fonts-noto-cjk-extra/download>

將 `.deb` 檔案放入 `offline_packages/fonts/` 目錄。

#### 使用 Docker 下載

```bash
docker run -it --rm -v $(pwd)/fonts:/packages debian:buster bash

# 容器內
apt-get update
cd /packages
apt-get download fonts-noto-cjk fonts-noto-cjk-extra
exit
```

---

### 3.6 下載 Nginx

> 📥 Nginx 下載

#### 手動下載 (Windows / macOS 通用)

訪問 Debian Packages 下載：

- <https://packages.debian.org/buster/amd64/nginx/download>

將 `.deb` 檔案放入 `offline_packages/nginx/` 目錄。

#### 使用 Docker 下載

```bash
docker run -it --rm -v $(pwd)/nginx:/packages debian:buster bash

# 容器內
apt-get update
cd /packages
apt-get download nginx nginx-common nginx-full
apt-cache depends nginx | grep Depends | awk '{print $2}' | xargs apt-get download 2>/dev/null || true
exit
```

---

### 3.7 準備應用程式

> ⚠️ 需要在本機安裝 Node.js 環境

#### Windows (PowerShell)

```powershell
cd "$env:USERPROFILE\Desktop\offline_packages\app"

# 1. 複製專案 (或手動複製)
git clone <your-repo-url> llrwd-rms
cd llrwd-rms

# 2. 安裝所有套件
npm install

# 3. 建置專案
npm run build

# 4. 使用 tar 打包 (Windows 10+ 支援)
cd ..

# 打包原始碼 (不含 node_modules 和 .next)
tar -cvf llrwd-rms-src.tar --exclude="node_modules" --exclude=".next" llrwd-rms
gzip llrwd-rms-src.tar

# 打包 node_modules
tar -cvf node_modules.tar llrwd-rms/node_modules
gzip node_modules.tar

# 打包建置結果
tar -cvf llrwd-rms-build.tar llrwd-rms/.next llrwd-rms/public
gzip llrwd-rms-build.tar
```

#### macOS (Terminal)

```bash
cd ~/Desktop/offline_packages/app

# 1. 複製專案
git clone <your-repo-url> llrwd-rms
cd llrwd-rms

# 2. 安裝所有套件
npm install

# 3. 建置專案
npm run build

# 4. 打包
cd ..

# 打包原始碼 (不含 node_modules 和 .next)
tar --exclude='node_modules' --exclude='.next' -czvf llrwd-rms-src.tar.gz llrwd-rms

# 打包 node_modules
tar -czvf node_modules.tar.gz llrwd-rms/node_modules

# 打包建置結果
tar -czvf llrwd-rms-build.tar.gz llrwd-rms/.next llrwd-rms/public
```

---

### 3.8 建立安裝腳本

#### Windows (使用記事本或 VS Code)

建立檔案 `offline_packages/scripts/install.sh`，內容如下：

```bash
#!/bin/bash

# ============================================
# LLRWD-RMS 離線安裝腳本
# ============================================

set -e

INSTALL_DIR="/opt/llrwd-rms"
PACKAGES_DIR="$(dirname "$0")/.."

echo "====================================="
echo "  LLRWD-RMS 離線安裝程式"
echo "====================================="

# 檢查是否為 root
if [ "$EUID" -ne 0 ]; then
    echo "請使用 root 權限執行此腳本"
    exit 1
fi

# 1. 安裝 Node.js
echo ""
echo "[1/6] 安裝 Node.js..."
cd "$PACKAGES_DIR/nodejs"
tar -xJf node-v*.tar.xz -C /usr/local --strip-components=1
node --version && echo "Node.js 安裝完成"

# 2. 安裝 PostgreSQL
echo ""
echo "[2/6] 安裝 PostgreSQL..."
cd "$PACKAGES_DIR/postgresql"
dpkg -i *.deb 2>/dev/null || apt-get -f install -y --allow-downgrades
systemctl enable postgresql
systemctl start postgresql
echo "PostgreSQL 安裝完成"

# 3. 安裝 Chromium
echo ""
echo "[3/6] 安裝 Chromium..."
cd "$PACKAGES_DIR/chromium"
dpkg -i *.deb 2>/dev/null || apt-get -f install -y --allow-downgrades
echo "Chromium 安裝完成"

# 4. 安裝中文字型
echo ""
echo "[4/6] 安裝中文字型..."
cd "$PACKAGES_DIR/fonts"
dpkg -i *.deb 2>/dev/null || true
fc-cache -fv
echo "中文字型安裝完成"

# 5. 安裝 Nginx
echo ""
echo "[5/6] 安裝 Nginx..."
cd "$PACKAGES_DIR/nginx"
dpkg -i *.deb 2>/dev/null || apt-get -f install -y --allow-downgrades
systemctl enable nginx
echo "Nginx 安裝完成"

# 6. 部署應用程式
echo ""
echo "[6/6] 部署應用程式..."
mkdir -p "$INSTALL_DIR"
cd "$PACKAGES_DIR/app"

# 解壓原始碼
tar -xzf llrwd-rms-src.tar.gz -C "$INSTALL_DIR" --strip-components=1

# 解壓 node_modules
tar -xzf node_modules.tar.gz -C "$INSTALL_DIR" --strip-components=1

# 解壓建置結果
tar -xzf llrwd-rms-build.tar.gz -C "$INSTALL_DIR" --strip-components=1

echo "應用程式部署完成"

echo ""
echo "====================================="
echo "  基礎安裝完成！"
echo "  請繼續執行以下步驟："
echo "  1. 設定資料庫"
echo "  2. 設定環境變數"
echo "  3. 啟動服務"
echo "====================================="
```

> ⚠️ **重要**: 請確保儲存檔案時使用 **LF** 換行符號 (Unix 格式)，而非 Windows 的 CRLF。可使用 VS Code 右下角切換。

#### macOS (Terminal)

```bash
cd ~/Desktop/offline_packages/scripts

cat > install.sh << 'SCRIPT_END'
#!/bin/bash

# ============================================
# LLRWD-RMS 離線安裝腳本
# ============================================

set -e

INSTALL_DIR="/opt/llrwd-rms"
PACKAGES_DIR="$(dirname "$0")/.."

echo "====================================="
echo "  LLRWD-RMS 離線安裝程式"
echo "====================================="

if [ "$EUID" -ne 0 ]; then
    echo "請使用 root 權限執行此腳本"
    exit 1
fi

echo ""
echo "[1/6] 安裝 Node.js..."
cd "$PACKAGES_DIR/nodejs"
tar -xJf node-v*.tar.xz -C /usr/local --strip-components=1
node --version && echo "Node.js 安裝完成"

echo ""
echo "[2/6] 安裝 PostgreSQL..."
cd "$PACKAGES_DIR/postgresql"
dpkg -i *.deb 2>/dev/null || apt-get -f install -y --allow-downgrades
systemctl enable postgresql
systemctl start postgresql
echo "PostgreSQL 安裝完成"

echo ""
echo "[3/6] 安裝 Chromium..."
cd "$PACKAGES_DIR/chromium"
dpkg -i *.deb 2>/dev/null || apt-get -f install -y --allow-downgrades
echo "Chromium 安裝完成"

echo ""
echo "[4/6] 安裝中文字型..."
cd "$PACKAGES_DIR/fonts"
dpkg -i *.deb 2>/dev/null || true
fc-cache -fv
echo "中文字型安裝完成"

echo ""
echo "[5/6] 安裝 Nginx..."
cd "$PACKAGES_DIR/nginx"
dpkg -i *.deb 2>/dev/null || apt-get -f install -y --allow-downgrades
systemctl enable nginx
echo "Nginx 安裝完成"

echo ""
echo "[6/6] 部署應用程式..."
mkdir -p "$INSTALL_DIR"
cd "$PACKAGES_DIR/app"
tar -xzf llrwd-rms-src.tar.gz -C "$INSTALL_DIR" --strip-components=1
tar -xzf node_modules.tar.gz -C "$INSTALL_DIR" --strip-components=1
tar -xzf llrwd-rms-build.tar.gz -C "$INSTALL_DIR" --strip-components=1
echo "應用程式部署完成"

echo ""
echo "====================================="
echo "  基礎安裝完成！"
echo "  請繼續執行以下步驟："
echo "  1. 設定資料庫"
echo "  2. 設定環境變數"
echo "  3. 啟動服務"
echo "====================================="
SCRIPT_END

chmod +x install.sh
```

---

### 3.9 打包所有檔案

#### Windows (PowerShell)

```powershell
cd "$env:USERPROFILE\Desktop"

# 使用 Windows 內建 tar 打包
tar -czvf offline_packages.tar.gz offline_packages

# 或使用 7-Zip (如已安裝)
# & "C:\Program Files\7-Zip\7z.exe" a -ttar offline_packages.tar offline_packages
# & "C:\Program Files\7-Zip\7z.exe" a -tgzip offline_packages.tar.gz offline_packages.tar
```

#### macOS (Terminal)

```bash
cd ~/Desktop

# 打包全部檔案
tar -czvf offline_packages.tar.gz offline_packages/
```

---

### 3.10 下載檔案完整清單

完成下載後，確認目錄結構如下：

```
offline_packages/
├── nodejs/
│   └── node-v20.11.1-linux-x64.tar.xz     (~30 MB)
├── postgresql/
│   ├── postgresql-16_*.deb
│   ├── postgresql-client-16_*.deb
│   ├── postgresql-common_*.deb
│   └── libpq5_*.deb                        (~50 MB 總計)
├── chromium/
│   ├── chromium-browser_*.deb
│   └── (其他相依套件)                       (~150 MB 總計)
├── fonts/
│   ├── fonts-noto-cjk_*.deb
│   └── fonts-noto-cjk-extra_*.deb          (~20 MB)
├── nginx/
│   ├── nginx_*.deb
│   └── (其他相依套件)                       (~5 MB)
├── app/
│   ├── llrwd-rms-src.tar.gz
│   ├── node_modules.tar.gz
│   └── llrwd-rms-build.tar.gz              (~500 MB 總計)
└── scripts/
    └── install.sh
```

最終打包的 `offline_packages.tar.gz` 約 **800 MB - 1 GB**。

---

## 4. 檔案傳輸至離線主機

### 4.1 使用 USB 隨身碟

```bash
# 在線上主機
cp ~/offline_packages.tar.gz /media/usb/

# 在離線主機
cp /media/usb/offline_packages.tar.gz /tmp/
cd /tmp
tar -xzf offline_packages.tar.gz
```

### 4.2 使用 SCP (如有內部網路連線)

```bash
scp ~/offline_packages.tar.gz user@OFFLINE_HOST:/tmp/
```

### 4.3 使用 rsync

```bash
rsync -avz --progress ~/offline_packages/ user@OFFLINE_HOST:/tmp/offline_packages/
```

---

## 5. 離線主機安裝流程

> ⚠️ 以下步驟在**離線 Linux 主機**上執行

### 5.1 解壓檔案

```bash
cd /tmp
tar -xzf offline_packages.tar.gz
cd offline_packages
```

### 5.2 執行安裝腳本

```bash
sudo bash scripts/install.sh
```

### 5.3 驗證安裝

```bash
# 驗證 Node.js
node --version
# 預期輸出: v20.x.x

npm --version
# 預期輸出: 10.x.x

# 驗證 PostgreSQL
psql --version
# 預期輸出: psql (PostgreSQL) 16.x

# 驗證 Chromium (Debian 10 的套件名稱是 chromium)
chromium --version
# 預期輸出: Chromium xxx

# 驗證 Nginx
nginx -v
# 預期輸出: nginx version: nginx/x.x.x
```

---

## 6. 應用程式部署

### 6.1 建立資料庫

```bash
# 切換至 postgres 使用者
sudo -u postgres psql

-- 建立資料庫
CREATE DATABASE llrwd_rms;

-- 建立使用者
CREATE USER llrwd_user WITH ENCRYPTED PASSWORD 'YourStrongPassword123!';

-- 授予權限
GRANT ALL PRIVILEGES ON DATABASE llrwd_rms TO llrwd_user;

-- 授予 schema 權限 (PostgreSQL 15+)
\c llrwd_rms
GRANT ALL ON SCHEMA public TO llrwd_user;

-- 離開
\q
```

### 6.2 設定環境變數

```bash
# 建立環境變數檔案
sudo nano /opt/llrwd-rms/.env
```

寫入以下內容：

```env
# 資料庫
DATABASE_URL="postgresql://llrwd_user:YourStrongPassword123!@localhost:5432/llrwd_rms"

# NextAuth
NEXTAUTH_SECRET="your-super-secret-key-at-least-32-characters-long"
NEXTAUTH_URL="http://YOUR_SERVER_IP"

# Node 環境
NODE_ENV=production

# Puppeteer (Debian 10 使用 /usr/bin/chromium)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

> 💡 產生 NEXTAUTH_SECRET：`openssl rand -base64 32`

### 6.3 初始化資料庫

```bash
cd /opt/llrwd-rms

# 執行 Prisma 遷移
npx prisma db push

# 建立預設管理員
npx prisma db seed
```

### 6.4 建立上傳目錄

```bash
mkdir -p /opt/llrwd-rms/public/uploads
mkdir -p /opt/llrwd-rms/public/iso-docs
chown -R www-data:www-data /opt/llrwd-rms/public/uploads
chown -R www-data:www-data /opt/llrwd-rms/public/iso-docs
```

### 6.5 測試啟動

```bash
cd /opt/llrwd-rms
npm start
```

開啟瀏覽器訪問 `http://YOUR_SERVER_IP:3000` 測試。

---

## 7. 系統服務設定

### 7.1 建立 Systemd 服務

```bash
sudo nano /etc/systemd/system/llrwd-rms.service
```

寫入以下內容：

```ini
[Unit]
Description=LLRWD-RMS Next.js Application
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/llrwd-rms
EnvironmentFile=/opt/llrwd-rms/.env
ExecStart=/usr/local/bin/node /opt/llrwd-rms/.next/standalone/server.js
Restart=on-failure
RestartSec=10

# 日誌設定
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=llrwd-rms

# 資源限制
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### 7.2 啟用並啟動服務

```bash
# 重載 systemd
sudo systemctl daemon-reload

# 啟用開機自動啟動
sudo systemctl enable llrwd-rms

# 啟動服務
sudo systemctl start llrwd-rms

# 檢查狀態
sudo systemctl status llrwd-rms
```

### 7.3 設定 PostgreSQL 開機啟動

```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

---

## 8. Nginx 反向代理設定

### 8.1 建立 Nginx 設定檔

```bash
sudo nano /etc/nginx/sites-available/llrwd-rms
```

寫入以下內容：

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;  # 或內部網域名稱

    # 日誌
    access_log /var/log/nginx/llrwd-rms.access.log;
    error_log /var/log/nginx/llrwd-rms.error.log;

    # 安全標頭
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 上傳大小限制 (100MB)
    client_max_body_size 100M;

    # 反向代理
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超時設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 靜態檔案快取
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 60d;
        add_header Cache-Control "public, max-age=5184000, immutable";
    }

    # 上傳檔案
    location /uploads {
        alias /opt/llrwd-rms/public/uploads;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }

    # ISO 文件
    location /iso-docs {
        alias /opt/llrwd-rms/public/iso-docs;
        expires 1d;
    }
}
```

### 8.2 啟用設定

```bash
# 建立軟連結
sudo ln -s /etc/nginx/sites-available/llrwd-rms /etc/nginx/sites-enabled/

# 移除預設站台 (可選)
sudo rm /etc/nginx/sites-enabled/default

# 測試設定
sudo nginx -t

# 重啟 Nginx
sudo systemctl restart nginx

# 啟用開機自動啟動
sudo systemctl enable nginx
```

---

## 9. 防火牆設定

### 9.1 使用 UFW (Ubuntu)

```bash
# 安裝 ufw (如果已有離線包)
sudo dpkg -i /tmp/offline_packages/ufw/*.deb

# 設定防火牆規則
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 僅允許內部網路存取 (範例)
sudo ufw allow from 192.168.1.0/24 to any port 80

# 啟用防火牆
sudo ufw enable

# 檢查狀態
sudo ufw status verbose
```

### 9.2 使用 firewalld (RHEL/CentOS)

```bash
# 開放 HTTP
sudo firewall-cmd --permanent --add-service=http

# 開放特定網段
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port port="80" protocol="tcp" accept'

# 重載配置
sudo firewall-cmd --reload
```

---

## 10. 驗證與測試

### 10.1 檢查服務狀態

```bash
# 檢查 Next.js 應用程式
sudo systemctl status llrwd-rms

# 檢查 PostgreSQL
sudo systemctl status postgresql

# 檢查 Nginx
sudo systemctl status nginx
```

### 10.2 檢查端口

```bash
# 檢查監聽端口
sudo netstat -tlnp | grep -E '80|3000|5432'

# 或使用 ss
sudo ss -tlnp | grep -E '80|3000|5432'
```

### 10.3 功能測試檢查清單

| 功能 | 測試步驟 | 預期結果 |
|------|----------|----------|
| 首頁載入 | 訪問 `http://SERVER_IP` | 顯示登入頁面 |
| 登入功能 | 使用 admin/adminpassword | 成功登入 |
| 新增專案 | 建立測試專案 | 專案建立成功 |
| 新增項目 | 在專案內新增項目 | 項目建立並通過審核 |
| 檔案上傳 | 上傳 PDF 檔案 | 檔案成功上傳 |
| PDF 生成 | 審核通過後生成 QC 文件 | PDF 正確生成含中文 |
| 搜尋功能 | 在專案內搜尋關鍵字 | 顯示搜尋結果 |

---

## 11. 維護與備份

### 11.1 手動備份

```bash
# 建立備份目錄
mkdir -p /backup/llrwd-rms

# 備份資料庫
sudo -u postgres pg_dump llrwd_rms > /backup/llrwd-rms/db_$(date +%Y%m%d).sql

# 備份上傳檔案
tar -czvf /backup/llrwd-rms/uploads_$(date +%Y%m%d).tar.gz /opt/llrwd-rms/public/uploads

# 備份 ISO 文件
tar -czvf /backup/llrwd-rms/iso-docs_$(date +%Y%m%d).tar.gz /opt/llrwd-rms/public/iso-docs
```

### 11.2 自動備份腳本

```bash
sudo nano /opt/llrwd-rms/scripts/backup.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/backup/llrwd-rms"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# 備份資料庫
sudo -u postgres pg_dump llrwd_rms | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# 備份檔案
tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" \
    /opt/llrwd-rms/public/uploads \
    /opt/llrwd-rms/public/iso-docs \
    /opt/llrwd-rms/.env

# 清理舊備份
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "備份完成: $DATE"
```

```bash
chmod +x /opt/llrwd-rms/scripts/backup.sh

# 加入 crontab (每日凌晨 2 點執行)
echo "0 2 * * * /opt/llrwd-rms/scripts/backup.sh >> /var/log/llrwd-backup.log 2>&1" | sudo tee -a /etc/crontab
```

### 11.3 還原備份

```bash
# 還原資料庫
gunzip -c /backup/llrwd-rms/db_YYYYMMDD.sql.gz | sudo -u postgres psql llrwd_rms

# 還原檔案
tar -xzf /backup/llrwd-rms/files_YYYYMMDD.tar.gz -C /
```

### 11.4 日誌檢視

```bash
# 應用程式日誌
sudo journalctl -u llrwd-rms -f

# Nginx 存取日誌
sudo tail -f /var/log/nginx/llrwd-rms.access.log

# Nginx 錯誤日誌
sudo tail -f /var/log/nginx/llrwd-rms.error.log

# PostgreSQL 日誌
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

---

## 12. 常見問題排解

### Q1: Node.js 指令找不到

**原因**: PATH 未設定

**解決**:

```bash
echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Q2: PostgreSQL 連線失敗

**原因**: 認證設定問題

**解決**:

```bash
# 編輯 pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf

# 將 peer 改為 md5 或 scram-sha-256
# local   all   all   md5

sudo systemctl restart postgresql
```

### Q3: Puppeteer 無法執行

**原因**: 缺少 Chromium 相依套件

**解決**:

```bash
# 檢查缺少的相依 (Debian 10 使用 chromium)
ldd /usr/bin/chromium | grep "not found"

# 安裝缺少的套件
```

### Q4: 中文 PDF 顯示方塊

**原因**: 字型未正確安裝

**解決**:

```bash
# 重新安裝字型
sudo dpkg -i /tmp/offline_packages/fonts/*.deb
sudo fc-cache -fv

# 驗證字型
fc-list | grep -i noto
```

### Q5: 服務啟動失敗

**原因**: 權限問題

**解決**:

```bash
# 檢查擁有者
ls -la /opt/llrwd-rms

# 修正權限
sudo chown -R www-data:www-data /opt/llrwd-rms
sudo chmod -R 755 /opt/llrwd-rms
```

### Q6: 上傳檔案失敗

**原因**: 權限或大小限制

**解決**:

```bash
# 檢查 uploads 目錄權限
ls -la /opt/llrwd-rms/public/uploads

# 修正權限
sudo chown -R www-data:www-data /opt/llrwd-rms/public/uploads
sudo chmod 755 /opt/llrwd-rms/public/uploads

# 檢查 Nginx 上傳限制
grep client_max_body_size /etc/nginx/sites-available/llrwd-rms
```

---

## 完整版本對照表

確保所有套件版本相容：

| 套件 | 建議版本 | 備註 |
|------|----------|------|
| Node.js | 20.11.x LTS | 必須使用 20.x |
| npm | 10.x | 隨 Node.js 安裝 |
| PostgreSQL | 16.x | 15.x 亦可 |
| Chromium | buster 版本 | 套件名稱為 `chromium` |
| Nginx | 1.14+ | buster 預設版本 |
| Debian | 10 (buster) | 長期支援 |

> ⚠️ **Debian 10 特殊說明**: Debian 10 的 Chromium 套件名稱是 `chromium`，而非 Ubuntu 的 `chromium-browser`，執行檔路徑為 `/usr/bin/chromium`。

---

## 快速檢查清單

### 安裝前

- [ ] 確認離線包 (`offline_packages.tar.gz`) 已傳輸
- [ ] 確認主機有足夠磁碟空間 (至少 10GB 可用)
- [ ] 確認擁有 root 或 sudo 權限

### 安裝後

- [ ] Node.js 版本正確 (`node -v`)
- [ ] PostgreSQL 運行中 (`systemctl status postgresql`)
- [ ] 資料庫已建立並可連線
- [ ] 環境變數已設定 (`cat /opt/llrwd-rms/.env`)
- [ ] 應用程式服務運行中 (`systemctl status llrwd-rms`)
- [ ] Nginx 運行中 (`systemctl status nginx`)
- [ ] 網頁可正常存取
- [ ] 可以正常登入系統
- [ ] PDF 生成功能正常 (含中文)
- [ ] 備份腳本已設定

---

## 更新程式版本

若需更新應用程式：

1. 在線上主機重新打包新版本
2. 傳輸至離線主機
3. 停止服務：`sudo systemctl stop llrwd-rms`
4. 備份舊版本：`mv /opt/llrwd-rms /opt/llrwd-rms.bak`
5. 解壓新版本
6. 還原環境變數：`cp /opt/llrwd-rms.bak/.env /opt/llrwd-rms/`
7. 執行 Prisma 遷移：`cd /opt/llrwd-rms && npx prisma db push`
8. 重新啟動：`sudo systemctl start llrwd-rms`
