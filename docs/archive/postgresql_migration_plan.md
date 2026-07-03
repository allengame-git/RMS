# PostgreSQL 資料庫遷移計畫

## 目標

將 RMS 系統的資料庫從 SQLite 遷移至 PostgreSQL，提升系統的併發處理能力、資料可靠性與擴展性。

---

## Phase 1: 環境準備

### 1.1 調整 Prisma Schema

#### [MODIFY] `prisma/schema.prisma`

```diff
datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
}
```

> [!NOTE]
> Prisma 會自動處理 SQLite → PostgreSQL 的類型對應：
>
> - `String` → `TEXT`
> - `Int @id @default(autoincrement())` → `SERIAL`
> - `DateTime` → `TIMESTAMP WITH TIME ZONE`

### 1.2 環境變數配置

#### [MODIFY] `.env`

```env
# SQLite (原有)
# DATABASE_URL="file:./dev.db"

# PostgreSQL (新)
DATABASE_URL="postgresql://rms_user:rms_password@localhost:5432/rms_db?schema=public"
```

#### [MODIFY] `.env.example`

```env
DATABASE_URL="postgresql://username:password@host:5432/database?schema=public"
```

---

## Phase 2: Docker 配置更新

### 2.1 新增 PostgreSQL 服務

#### [MODIFY] `docker-compose.yml`

```yaml
services:
  # 新增 PostgreSQL 服務
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

  rms-app:
    build: .
    container_name: rms-application
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://rms_user:${POSTGRES_PASSWORD:-rms_secure_password}@postgres:5432/rms_db?schema=public
      - NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    volumes:
      - rms-uploads:/app/public/uploads
      - rms-iso-docs:/app/public/iso_doc
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - rms-network

volumes:
  postgres-data:
    driver: local
  rms-uploads:
    driver: local
  rms-iso-docs:
    driver: local
```

---

## Phase 3: 資料遷移腳本

### 3.1 建立遷移工具

#### [NEW] `scripts/migrate-to-postgres.ts`

```typescript
import { PrismaClient as SqliteClient } from '@prisma/client';
import { PrismaClient as PostgresClient } from '@prisma/client';

// 遷移順序 (依照外鍵關係)
const MIGRATION_ORDER = [
  'User',
  'Project', 
  'Item',
  'ItemRelation',
  'ChangeRequest',
  'ItemHistory',
  'QCDocumentApproval',
  'DataFile',
  'DataFileChangeRequest',
  'DataFileHistory'
];

async function migrateData() {
  // 1. 連接兩個資料庫
  // 2. 依序遷移每個模型
  // 3. 重置 PostgreSQL 序列值
}
```

### 3.2 資料匯出/匯入流程

| 步驟 | 指令 | 說明 |
|------|------|------|
| 1 | `npm run export:sqlite` | 匯出 SQLite 資料為 JSON |
| 2 | `npx prisma migrate dev` | 建立 PostgreSQL schema |
| 3 | `npm run import:postgres` | 匯入資料到 PostgreSQL |
| 4 | `npm run verify:migration` | 驗證資料完整性 |

---

## Phase 4: 應用程式調整

### 4.1 更新 Prisma Client

```bash
# 重新生成 Prisma Client (針對 PostgreSQL)
npx prisma generate

# 執行資料庫遷移
npx prisma migrate dev --name init-postgres
```

### 4.2 更新健康檢查

#### [MODIFY] `src/app/api/health/route.ts`

```typescript
// 測試 PostgreSQL 連線
try {
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ status: 'healthy', db: 'connected' });
} catch {
  return NextResponse.json({ status: 'unhealthy', db: 'disconnected' }, { status: 503 });
}
```

---

## Phase 5: 部署腳本更新

### 5.1 備份腳本

#### [MODIFY] `scripts/backup.ps1`

```powershell
# PostgreSQL 備份
docker exec rms-postgres pg_dump -U rms_user -d rms_db > "$BackupDir\rms_db_$timestamp.sql"
```

### 5.2 還原腳本

#### [MODIFY] `scripts/restore.ps1`

```powershell
# PostgreSQL 還原
Get-Content $SqlFile | docker exec -i rms-postgres psql -U rms_user -d rms_db
```

---

## Verification Plan

### 自動化測試

```bash
# 1. 啟動 PostgreSQL 容器
docker compose up postgres -d

# 2. 執行遷移
npx prisma migrate dev

# 3. 執行種子資料
npx prisma db seed

# 4. 啟動應用程式測試
npm run dev
```

### 手動驗證清單

- [ ] PostgreSQL 容器正常啟動
- [ ] Prisma migrate 成功執行
- [ ] 應用程式可正常登入
- [ ] 專案/項目 CRUD 正常
- [ ] 審核流程正常
- [ ] 檔案上傳正常
- [ ] ISO 文件生成正常
- [ ] QC 審核流程正常

---

## File Summary

| 動作 | 檔案 |
|------|------|
| [MODIFY] | `prisma/schema.prisma` |
| [MODIFY] | `.env` / `.env.example` |
| [MODIFY] | `docker-compose.yml` |
| [NEW] | `scripts/migrate-to-postgres.ts` |
| [NEW] | `scripts/export-sqlite.ts` |
| [NEW] | `scripts/import-postgres.ts` |
| [MODIFY] | `scripts/backup.ps1` |
| [MODIFY] | `scripts/restore.ps1` |
| [MODIFY] | `src/app/api/health/route.ts` |
| [MODIFY] | `Dockerfile` |

---

## 風險與注意事項

> [!WARNING]
> 遷移前務必完整備份 SQLite 資料庫

> [!CAUTION]
> PostgreSQL 的字串比較預設為 case-sensitive，可能影響搜尋功能

> [!IMPORTANT]
> 遷移完成後需驗證所有外鍵關係是否正確建立
