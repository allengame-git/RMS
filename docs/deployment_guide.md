# RMS 系統 Windows 部署規劃文件

> **版本**: 1.2  
> **日期**: 2026-01-10  
> **專案技術棧**: Next.js 14 + Prisma + PostgreSQL + NextAuth.js

---

## 目錄

1. [專案架構概述](#1-專案架構概述)
2. [Docker 容器化部署](#2-docker-容器化部署)
3. [HTTPS 安全配置](#3-https-安全配置)
4. [系統備份策略](#4-系統備份策略)
5. [系統遷移指南](#5-系統遷移指南)
6. [災難復原計劃](#6-災難復原計劃)
7. [維運監控](#7-維運監控)
8. [部署檢查清單](#8-部署檢查清單)

---

## 1. 專案架構概述

### 1.1 技術棧

| 層級 | 技術 | 說明 |
|------|------|------|
| 前端 | Next.js 14 (App Router) | React 框架，SSR/SSG 支援 |
| 後端 | Next.js API Routes + Server Actions | 統一處理 API 請求 |
| 資料庫 | PostgreSQL + Prisma ORM | 強大且穩定的關聯式資料庫 |
| 認證 | NextAuth.js | 內建認證機制 |
| PDF 生成 | pdf-lib + Puppeteer | 支援多頁渲染與數位簽章 |
| 富文編輯 | Tiptap | 文件內容編輯器 |

### 1.2 目錄結構

```
RMS/
├── prisma/
│   └── schema.prisma    # 資料庫結構定義
├── public/
│   ├── uploads/         # 上傳檔案目錄
│   └── iso_doc/         # ISO 文件目錄
├── src/
│   ├── app/             # Next.js App Router
│   ├── actions/         # Server Actions
│   ├── components/      # React 元件
│   └── lib/             # 工具函式
└── .env                 # 環境變數
```

### 1.3 資料模型

- **User**: 使用者帳號與權限 (ADMIN/INSPECTOR/EDITOR/VIEWER)
- **Project**: 專案管理
- **Item**: 項目結構 (支援階層關係)
- **DataFile**: 檔案管理
- **ChangeRequest**: 變更申請工作流程
- **ItemHistory**: 歷史版本追蹤
- **LoginLog**: 登入審計日誌
- **Notification**: 通知系統

### 1.4 Windows 部署重要變更 (v2.1.2)

為解決 Windows 生產環境 (Production) 下的靜態資源快取與權限問題，系統已切換為 **代理路由架構 (Proxy Routes)**：

- **圖片資源**: 透過 `/uploads/[...path]` API 存取，而非直接讀取 `/uploads/` 靜態目錄。
- **PDF 文件**: 透過 `/iso_doc/[filename]` API 存取，由後端直接串流檔案。

> ⚠️ **維運注意**: 請確保執行帳號對 `public` 目錄擁有完整的 **讀取/寫入** 權限，否則代理路由將回傳 404 或 403 錯誤。

---

## 2. Docker 容器化部署

> **注意**: 此專案為 Next.js，搭配 PostgreSQL 資料庫。

### 2.1 Dockerfile

在專案根目錄建立 `Dockerfile`：

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Tell Puppeteer to skip installing Chrome. We'll use the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create directories for data persistence
RUN mkdir -p /app/data /app/public/uploads /app/public/iso_doc
RUN chown -R nextjs:nodejs /app/data /app/public/uploads /app/public/iso_doc

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 2.2 Docker Compose (完整配置)

建立 `docker-compose.yml`：

```yaml
services:
  # PostgreSQL 資料庫服務
  postgres:
    image: postgres:16-alpine
    container_name: rms-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: rms_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-rms_secure_password}
      POSTGRES_DB: rms_db
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - rms-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rms_user -d rms_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Next.js 應用程式
  rms-app:
    build: .
    container_name: rms-application
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # 連接到 postgres 服務
      - DATABASE_URL=postgresql://rms_user:${POSTGRES_PASSWORD:-rms_secure_password}@postgres:5432/rms_db?schema=public
      - NEXTAUTH_URL=https://your-domain.com
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    volumes:
      # 上傳檔案持久化
      - rms-uploads:/app/public/uploads
      # ISO 文件持久化
      - rms-iso-docs:/app/public/iso_doc
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - rms-network
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    container_name: rms-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - rms-uploads:/var/www/uploads:ro
    depends_on:
      - rms-app
    networks:
      - rms-network

volumes:
  postgres-data:
    driver: local
  rms-uploads:
    driver: local
  rms-iso-docs:
    driver: local

networks:
  rms-network:
    driver: bridge
```

### 2.3 next.config.mjs 調整

為 Docker 部署優化：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb'
    }
  }
};

export default nextConfig;
```

---

## 3. HTTPS 安全配置

### 3.1 Nginx 反向代理配置

建立 `nginx/nginx.conf`：

```nginx
events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Upstream
    upstream rms_app {
        server rms-app:3000;
        keepalive 32;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL certificates
        ssl_certificate     /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # SSL settings
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        # HSTS
        add_header Strict-Transport-Security "max-age=31536000" always;

        # Upload size
        client_max_body_size 100M;

        # API rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://rms_app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Static uploads
        location /uploads/ {
            alias /var/www/uploads/;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # Main application
        location / {
            proxy_pass http://rms_app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### 3.2 SSL 憑證取得

**選項 A: Let's Encrypt (免費)**

```powershell
# Windows - 使用 Certbot
choco install certbot
certbot certonly --standalone -d your-domain.com

# 將憑證複製到 nginx/ssl/
copy "C:\Certbot\live\your-domain.com\fullchain.pem" .\nginx\ssl\
copy "C:\Certbot\live\your-domain.com\privkey.pem" .\nginx\ssl\
```

**選項 B: 自簽憑證 (內部測試)**

```powershell
# 使用 OpenSSL 產生自簽憑證
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout nginx/ssl/privkey.pem `
  -out nginx/ssl/fullchain.pem `
  -subj "/CN=localhost"
```

---

## 4. 系統備份策略

### 4.1 備份項目

| 項目 | 來源 | 備份頻率 | 說明 |
|------|------|----------|------|
| 資料庫 | `rms-postgres` 容器 | 每日 | PostgreSQL 資料匯出 (SQL) |
| 上傳檔案 | `/app/public/uploads/` | 每週 | 使用者上傳檔案 |
| ISO 文件 | `/app/public/iso_doc/` | 每週 | 產生的 PDF 文件 |
| 環境設定 | `.env` | 變更時 | 敏感配置 |
| Docker 設定 | `docker-compose.yml` | 變更時 | 部署配置 |

### 4.2 自動備份腳本

建立 `scripts/backup.ps1` (Windows PowerShell)：

```powershell
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
```

### 4.3 Windows 排程任務

```powershell
# 建立每日備份排程任務
$Action = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument "-File C:\RMS\scripts\backup.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "RMS-DailyBackup" `
    -Action $Action -Trigger $Trigger -Settings $Settings `
    -Description "RMS 系統每日自動備份"
```

---

## 5. 系統遷移指南

### 5.1 遷移前準備

```powershell
# 1. 停止服務
docker compose down

# 2. 完整備份
.\scripts\backup.ps1 -BackupDir "C:\RMS-Migration"

# 3. 匯出 Docker 映像 (選擇性)
docker save rms-application:latest -o rms-image.tar
docker save postgres:16-alpine -o postgres-image.tar
```

### 5.2 遷移步驟

**在新伺服器上：**

```powershell
# 1. 安裝 Docker Desktop
# 下載: https://www.docker.com/products/docker-desktop

# 2. 複製專案檔案 (RMS 目錄)
# 確保 docker-compose.yml 存在

# 3. 載入 Docker 映像 (如果有匯出)
docker load -i rms-image.tar
docker load -i postgres-image.tar

# 4. 啟動服務 (建立空資料庫)
docker compose up -d postgres
Start-Sleep -Seconds 10
docker compose up -d rms-app nginx

# 5. 還原備份
.\scripts\restore.ps1 -BackupFile "C:\RMS-Migration\2026xxxx_xxxxxx.zip"
```

### 5.3 遷移驗證清單

- [ ] 網站可正常存取
- [ ] 使用者可登入
- [ ] 資料庫連線正常
- [ ] 資料完整顯示 (專案、項目)
- [ ] 檔案上傳/下載正常
- [ ] HTTPS 憑證正常
- [ ] 備份任務已設置

---

## 6. 災難復原計劃

### 6.1 故障等級定義

| 等級 | 描述 | 目標復原時間 (RTO) |
|------|------|-------------------|
| P1 | 系統完全無法存取 | < 30 分鐘 |
| P2 | 資料損壞但系統可運作 | < 2 小時 |
| P3 | 部分功能異常 | < 4 小時 |

### 6.2 快速復原腳本

建立 `scripts/restore.ps1`：

```powershell
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
```

### 6.3 健康檢查 API

在 `src/app/api/health/route.ts` 新增：

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // 測試資料庫連線
        await prisma.$queryRaw`SELECT 1`;
        
        return NextResponse.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (error) {
        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected'
        }, { status: 500 });
    }
}
```

---

## 7. 維運監控

### 7.1 日誌管理

```powershell
# 查看即時日誌
docker logs -f rms-application

# 匯出日誌
docker logs rms-application --since 24h > "C:\RMS-Logs\app-$(Get-Date -Format 'yyyyMMdd').log"
```

### 7.2 登入審計日誌

系統內建登入審計功能，記錄所有登入嘗試（成功/失敗）：

**檢視方式**：

- 管理介面：`/admin/audit`
- 資料庫查詢：`SELECT * FROM "LoginLog" ORDER BY "createdAt" DESC LIMIT 50;`

**記錄欄位**：

- 使用者名稱、成功/失敗、IP 位址、User-Agent、時間

**安全功能**：

- 帳號鎖定：連續 5 次登入失敗自動鎖定 15 分鐘
- 管理員可在 `/admin/users` 手動解鎖

### 7.3 資源監控

```powershell
# 監控容器資源使用
docker stats rms-application rms-nginx

# 檢查磁碟使用
docker system df -v
```

### 7.3 安全更新流程

```powershell
# 1. 備份當前系統
.\scripts\backup.ps1

# 2. 拉取最新程式碼
git pull origin main

# 3. 重建並更新容器
docker compose build --no-cache
docker compose up -d

# 4. 執行資料庫遷移 (如有)
docker exec rms-application npx prisma migrate deploy

# 5. 驗證系統正常
Invoke-RestMethod http://localhost:3000/api/health
```

---

## 8. 部署檢查清單

### 8.1 首次部署

- [ ] 安裝 Docker Desktop for Windows
- [ ] 安裝 Git
- [ ] 複製專案程式碼
- [ ] 設定 `.env` 環境變數
- [ ] 設定 SSL 憑證
- [ ] 執行 `docker compose up -d`
- [ ] 初始化資料庫 `docker exec rms-application npx prisma migrate deploy`
- [ ] 建立管理員帳號
- [ ] 設定 Windows 防火牆規則
- [ ] 設定自動備份排程
- [ ] **檢查字體檔案**: 確認 `public/fonts/` 目錄下包含 `ArialUnicode.ttf` 與 `Noto_Sans_TC/`
- [ ] **權限檢查**: 確認應用程式有 `public/uploads` 與 `public/iso_doc` 的寫入權限

### 8.2 環境變數範本

建立 `.env.production`：

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://rms_user:rms_secure_password@postgres:5432/rms_db?schema=public"
POSTGRES_PASSWORD="rms_secure_password"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secure-random-string-at-least-32-chars"

# App settings
NODE_ENV="production"
```

### 8.3 防火牆設定

```powershell
# 開放 HTTPS 埠
New-NetFirewallRule -DisplayName "RMS HTTPS" -Direction Inbound -Port 443 -Protocol TCP -Action Allow

# 開放 HTTP 埠 (重導向用)
New-NetFirewallRule -DisplayName "RMS HTTP" -Direction Inbound -Port 80 -Protocol TCP -Action Allow
```

---

## 附錄

### A. 常見問題排除

| 問題 | 可能原因 | 解決方案 |
|------|----------|----------|
| 容器無法啟動 | 記憶體不足 | 增加 Docker 記憶體限制 |
| 資料庫鎖定 | 並發寫入衝突 | 重啟容器 |
| 上傳失敗 | 磁碟空間不足 | 清理舊備份或擴充磁碟 |
| SSL 錯誤 | 憑證過期 | 更新 SSL 憑證 |
| 圖片/PDF 404 | 檔案權限不足 | 確認 `public` 目錄權限，或查看後端 Log (`[Uploads Proxy API]`) |

### B. 聯絡資訊

- **系統維護**: IT 部門
- **緊急聯絡**: (待填寫)
- **文件更新**: 2026-01-10
