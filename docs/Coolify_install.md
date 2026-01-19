# VPS + Coolify 部署指南

> 最後更新: 2026-01-15

本文件說明如何使用 VPS + Coolify 架設 LLRWD-RMS 系統。

---

## 目錄

1. [環境需求](#1-環境需求)
2. [VPS 初始設定](#2-vps-初始設定)
3. [安裝 Coolify](#3-安裝-coolify)
4. [建立 PostgreSQL 資料庫](#4-建立-postgresql-資料庫)
5. [部署應用程式](#5-部署應用程式)
6. [環境變數設定](#6-環境變數設定)
7. [網域與 SSL 設定](#7-網域與-ssl-設定)
8. [初始化資料庫](#8-初始化資料庫)
9. [Puppeteer 特殊設定](#9-puppeteer-特殊設定)
10. [備份與維護](#10-備份與維護)
11. [常見問題排解](#11-常見問題排解)

---

## 1. 環境需求

### VPS 規格建議

| 項目 | 最低需求 | 建議配置 |
|------|----------|----------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| 網路 | 固定 IP | 固定 IP + 防火牆 |

> ⚠️ **重要提醒**: Puppeteer 需要較多記憶體，建議至少 4GB RAM。

### 推薦 VPS 供應商

- [Vultr](https://www.vultr.com/)
- [DigitalOcean](https://www.digitalocean.com/)
- [Linode](https://www.linode.com/)
- [Hetzner](https://www.hetzner.com/) (歐洲)
- [Contabo](https://contabo.com/) (性價比高)

---

## 2. VPS 初始設定

### 2.1 SSH 連線

```bash
ssh root@YOUR_VPS_IP
```

### 2.2 系統更新

```bash
apt update && apt upgrade -y
```

### 2.3 建立非 root 使用者 (可選但建議)

```bash
# 建立使用者
adduser deploy

# 加入 sudo 群組
usermod -aG sudo deploy

# 切換使用者
su - deploy
```

### 2.4 設定防火牆

```bash
# 安裝 ufw
sudo apt install ufw -y

# 允許 SSH
sudo ufw allow 22

# 允許 HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# 允許 Coolify (預設 8000)
sudo ufw allow 8000

# 啟用防火牆
sudo ufw enable

# 檢查狀態
sudo ufw status
```

### 2.5 安裝 Docker (Coolify 會自動安裝，但可預先安裝)

```bash
# 安裝 Docker
curl -fsSL https://get.docker.com | sh

# 將使用者加入 docker 群組
sudo usermod -aG docker $USER

# 重新登入使 docker 群組生效
exit
ssh deploy@YOUR_VPS_IP
```

---

## 3. 安裝 Coolify

### 3.1 一鍵安裝 Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

安裝過程約需 5-10 分鐘，完成後會顯示：

- Coolify Dashboard URL: `http://YOUR_VPS_IP:8000`
- 初始設定頁面

### 3.2 初始設定

1. 開啟瀏覽器訪問 `http://YOUR_VPS_IP:8000`
2. 建立管理員帳號
3. 設定實例名稱
4. 連接 Git Provider (GitHub/GitLab/Bitbucket)

### 3.3 連接 GitHub

1. 進入 **Settings** → **Sources**
2. 點擊 **Add Source** → **GitHub**
3. 選擇 **GitHub App** (建議) 或 **Personal Access Token**
4. 按照指示完成 OAuth 授權

---

## 4. 建立 PostgreSQL 資料庫

### 4.1 在 Coolify 建立資料庫

1. 進入 **Resources** → **Add Resource**
2. 選擇 **Database** → **PostgreSQL**
3. 填寫設定：

| 設定項目 | 建議值 |
|----------|--------|
| Name | `llrwd-postgres` |
| Database Name | `llrwd_rms` |
| Username | `llrwd_user` |
| Password | (自動生成或自訂強密碼) |
| Version | `16` (最新穩定版) |

1. 點擊 **Deploy**

### 4.2 取得連線資訊

部署完成後，在資料庫詳情頁面取得：

```
DATABASE_URL=postgresql://llrwd_user:PASSWORD@localhost:5432/llrwd_rms
```

> 💡 **注意**: 如果應用程式與資料庫在同一台 VPS，使用 `localhost` 或 Docker 內部網路名稱。

---

## 5. 部署應用程式

### 5.1 建立新專案

1. 進入 **Projects** → **Add Project**
2. 輸入專案名稱：`LLRWD-RMS`

### 5.2 新增應用程式

1. 在專案內點擊 **Add Resource** → **Application**
2. 選擇 **Public Repository** 或 **Private Repository**
3. 輸入 Git 倉庫 URL

### 5.3 建置設定

| 設定項目 | 值 |
|----------|-----|
| Build Pack | **Nixpacks** (建議) 或 **Dockerfile** |
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Port | `3000` |
| Base Directory | `/` |

### 5.4 使用自訂 Dockerfile (建議)

如果專案已有 Dockerfile，選擇 **Dockerfile** 作為 Build Pack：

```dockerfile
# 專案根目錄的 Dockerfile
FROM node:20-alpine AS base

# 安裝 Puppeteer 依賴
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 設定 Puppeteer 環境變數
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 安裝依賴
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 建置應用
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# 生產環境
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# 複製必要檔案
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 建立上傳目錄
RUN mkdir -p /app/public/uploads /app/public/iso-docs

EXPOSE 3000
CMD ["node", "server.js"]
```

### 5.5 next.config.js 設定

確保 `next.config.js` 啟用 standalone 輸出：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    experimental: {
        serverComponentsExternalPackages: ['puppeteer', 'pdfkit'],
    },
};

module.exports = nextConfig;
```

---

## 6. 環境變數設定

在 Coolify 應用程式設定中，進入 **Environment Variables**，加入以下變數：

### 6.1 必要環境變數

```env
# 資料庫連線
DATABASE_URL=postgresql://llrwd_user:PASSWORD@HOST:5432/llrwd_rms

# NextAuth 設定
NEXTAUTH_SECRET=your-super-secret-key-at-least-32-characters
NEXTAUTH_URL=https://your-domain.com

# Node 環境
NODE_ENV=production
```

### 6.2 產生 NEXTAUTH_SECRET

```bash
# 方法一：使用 openssl
openssl rand -base64 32

# 方法二：使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 6.3 Puppeteer 相關變數 (使用 Alpine)

```env
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### 6.4 完整環境變數範例

```env
DATABASE_URL=postgresql://llrwd_user:StrongP@ssw0rd!@llrwd-postgres:5432/llrwd_rms
NEXTAUTH_SECRET=xK3jM9pL2wN8qR5tY7uI0oP4aS6dF1gH
NEXTAUTH_URL=https://rms.example.com
NODE_ENV=production
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

---

## 7. 網域與 SSL 設定

### 7.1 DNS 設定

在您的網域註冊商處，新增 A 記錄：

| 類型 | 名稱 | 值 |
|------|------|-----|
| A | `rms` 或 `@` | `YOUR_VPS_IP` |

### 7.2 Coolify 網域設定

1. 進入應用程式 → **Settings** → **Domains**
2. 輸入網域：`rms.example.com`
3. 勾選 **Generate SSL Certificate** (Let's Encrypt)
4. 儲存變更

### 7.3 強制 HTTPS

Coolify 會自動處理 HTTP → HTTPS 重導向。

---

## 8. 初始化資料庫

### 8.1 首次部署後執行

進入 Coolify 應用程式的 **Terminal** 或透過 SSH：

```bash
# 進入容器
docker exec -it <container_name> sh

# 執行 Prisma 遷移
npx prisma db push

# 執行種子資料 (建立預設管理員)
npx prisma db seed
```

### 8.2 使用 Coolify 的 Post-Deployment Script

在 **Settings** → **Advanced** → **Post Deployment Command**：

```bash
npx prisma db push && npx prisma db seed || true
```

---

## 9. Puppeteer 特殊設定

### 9.1 Alpine Linux 設定

如果使用 Alpine-based Docker 映像，需安裝 Chromium：

```dockerfile
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk
```

### 9.2 Ubuntu/Debian 設定

```dockerfile
RUN apt-get update && apt-get install -y \
    chromium-browser \
    fonts-noto-cjk \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
```

### 9.3 中文字型支援

為確保 PDF 中文正確顯示，需安裝中文字型：

```dockerfile
# Alpine
RUN apk add --no-cache font-noto-cjk

# Ubuntu/Debian
RUN apt-get install -y fonts-noto-cjk
```

### 9.4 Puppeteer 啟動參數

在 `src/lib/html-renderer.ts` 中確保使用以下參數：

```typescript
const browser = await puppeteer.launch({
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
});
```

---

## 10. 備份與維護

### 10.1 資料庫備份

在 Coolify 中設定自動備份：

1. 進入 PostgreSQL 資源 → **Backups**
2. 設定備份頻率 (建議每日)
3. 設定保留數量

### 10.2 手動備份

```bash
# 進入資料庫容器
docker exec -it llrwd-postgres pg_dump -U llrwd_user llrwd_rms > backup.sql
```

### 10.3 檔案備份

上傳的檔案存放在容器內的 `/app/public/uploads`，需設定 Volume 持久化：

在 Coolify 應用程式 → **Storages**，新增：

| Source | Destination |
|--------|-------------|
| `/data/llrwd/uploads` | `/app/public/uploads` |
| `/data/llrwd/iso-docs` | `/app/public/iso-docs` |

### 10.4 系統備份 (使用內建功能)

應用程式內建備份功能：

1. 以 Admin 登入
2. 進入 **設定** → **系統備份**
3. 下載資料庫與檔案備份

---

## 11. 常見問題排解

### Q1: 應用程式啟動失敗

**原因**: 環境變數未設定

**解決**:

1. 檢查 `DATABASE_URL` 格式是否正確
2. 確認 `NEXTAUTH_SECRET` 已設定
3. 查看 Coolify Logs

### Q2: 資料庫連線失敗

**原因**: 網路設定問題

**解決**:

```bash
# 檢查資料庫是否運行
docker ps | grep postgres

# 測試連線
docker exec -it llrwd-postgres psql -U llrwd_user -d llrwd_rms
```

### Q3: Puppeteer 執行錯誤

**原因**: Chromium 未安裝或路徑錯誤

**解決**:

1. 確認 Dockerfile 有安裝 Chromium
2. 設定正確的 `PUPPETEER_EXECUTABLE_PATH`
3. 加入 `--no-sandbox` 參數

### Q4: 中文 PDF 顯示亂碼

**原因**: 缺少中文字型

**解決**:

```dockerfile
# 安裝 Noto CJK 字型
RUN apk add --no-cache font-noto-cjk
```

### Q5: 上傳檔案遺失

**原因**: 容器重建後資料遺失

**解決**:
設定 Volume 持久化 (參見 10.3 節)

### Q6: SSL 憑證申請失敗

**原因**: DNS 尚未生效

**解決**:

1. 等待 DNS 傳播 (最長 48 小時)
2. 確認 A 記錄指向正確 IP
3. 確認 80/443 端口已開放

---

## 快速檢查清單

部署前確認：

- [ ] VPS 已建立並可 SSH 連線
- [ ] 防火牆已開放 22, 80, 443, 8000 端口
- [ ] Coolify 已安裝並可訪問
- [ ] GitHub/GitLab 已連接
- [ ] PostgreSQL 資料庫已建立
- [ ] 環境變數已設定完成
- [ ] DNS A 記錄已指向 VPS IP
- [ ] Volume 持久化已設定

部署後確認：

- [ ] 應用程式可正常訪問
- [ ] 可以登入系統
- [ ] 可以新增/編輯項目
- [ ] PDF 生成功能正常
- [ ] 檔案上傳功能正常
- [ ] 備份功能正常

---

## 參考資源

- [Coolify 官方文件](https://coolify.io/docs)
- [Next.js 部署文件](https://nextjs.org/docs/deployment)
- [Prisma 部署指南](https://www.prisma.io/docs/guides/deployment)
- [Puppeteer Docker 最佳實踐](https://pptr.dev/guides/docker)
