/**
 * @file route.ts (api/admin/restore/database)
 * @description 管理員 - 資料庫全機復原 API 路由
 *
 * 提供系統災難復原功能，支援從 SQL 或 ZIP 備份檔重建整個資料庫。
 *
 * ## 核心功能
 * - 支援多格式：`.sql` (純文本) 或 `.zip` (帶清單的壓縮包)
 * - **安全預檢**：嚴格檢查 SQL 內容，確保至少包含一個 ADMIN 帳號及足夠的使用者資料，防止復原空資料庫導致鎖死
 * - **原子化更新**：解析 SQL 語句並逐行執行
 * - **強制同步**：復原完成後強制登出所有線上使用者，確保 Session 與新資料庫一致
 *
 * ## 警告
 * 此操作具備破壞性，會覆蓋當前所有資料庫內容。
 *
 * @see /src/lib/backup-utils.ts - 登出實作
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { forceLogoutAllUsers } from '@/lib/backup-utils';
import { prisma } from '@/lib/prisma';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // 1. 權限驗證
        const session = await getServerSession(authOptions);
        if (!session || !session.user || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: '權限不足，僅限管理員操作' }, { status: 403 });
        }

        // 2. 讀取上傳的檔案
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: '請選擇備份檔案' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let sql: string;
        let manifestStats: Record<string, number> | null = null;

        // 3. 判斷檔案類型並處理
        if (file.name.endsWith('.sql')) {
            // 直接讀取 SQL 檔案
            sql = buffer.toString('utf-8');
        } else if (file.name.endsWith('.zip')) {
            // 處理 ZIP 檔案（原有邏輯）
            const tempDir = path.join(os.tmpdir(), `rms-restore-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });

            const zipPath = path.join(tempDir, 'backup.zip');
            fs.writeFileSync(zipPath, buffer);

            // 解壓縮（含 Zip Slip 防護）
            const zip = new AdmZip(zipPath);
            const resolvedTempDir = path.resolve(tempDir);
            for (const entry of zip.getEntries()) {
                const resolvedTarget = path.resolve(tempDir, entry.entryName);
                if (!resolvedTarget.startsWith(resolvedTempDir + path.sep) && resolvedTarget !== resolvedTempDir) {
                    fs.rmSync(tempDir, { recursive: true });
                    return NextResponse.json({ error: '備份檔案包含不安全的路徑，已中止還原' }, { status: 400 });
                }
            }
            zip.extractAllTo(tempDir, true);

            // 驗證 manifest.json
            const manifestPath = path.join(tempDir, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                fs.rmSync(tempDir, { recursive: true });
                return NextResponse.json({ error: '無效的備份檔案：缺少 manifest.json' }, { status: 400 });
            }

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            if (manifest.backupType !== 'database') {
                fs.rmSync(tempDir, { recursive: true });
                return NextResponse.json({ error: '無效的備份檔案：這不是資料庫備份' }, { status: 400 });
            }

            // 讀取 SQL 檔案
            const sqlPath = path.join(tempDir, 'rms_db.sql');
            if (!fs.existsSync(sqlPath)) {
                fs.rmSync(tempDir, { recursive: true });
                return NextResponse.json({ error: '無效的備份檔案：缺少 rms_db.sql' }, { status: 400 });
            }

            sql = fs.readFileSync(sqlPath, 'utf-8');
            manifestStats = manifest.stats;

            // 清理暫存檔案
            fs.rmSync(tempDir, { recursive: true });
        } else {
            return NextResponse.json({ error: '不支援的檔案格式，請上傳 .sql 或 .zip 檔案' }, { status: 400 });
        }

        // 4. 驗證 SQL 內容（防止復原空白資料庫）
        const insertMatches = sql.match(/INSERT INTO/gi);
        const userInsertMatches = sql.match(/INSERT INTO "User"/gi);
        const adminInsertMatches = sql.match(/INSERT INTO "User"[^;]*'ADMIN'/gi);

        // 檢查是否有任何 INSERT 語句
        if (!insertMatches || insertMatches.length === 0) {
            return NextResponse.json({
                error: '無效的備份檔案：SQL 檔案中沒有任何資料。此備份可能是空的或已損壞。'
            }, { status: 400 });
        }

        // 檢查是否有使用者資料
        if (!userInsertMatches || userInsertMatches.length === 0) {
            return NextResponse.json({
                error: '無效的備份檔案：沒有使用者資料。復原此備份會導致無法登入系統。'
            }, { status: 400 });
        }

        // 檢查是否至少有一個管理員帳號
        if (!adminInsertMatches || adminInsertMatches.length === 0) {
            return NextResponse.json({
                error: '無效的備份檔案：沒有管理員帳號。復原此備份會導致無法管理系統。'
            }, { status: 400 });
        }

        // 備份檔案驗證通過

        // 5. 解析並過濾 SQL 語句
        const statements = sql
            .split(';\n')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--'));

        // SQL 語句類型白名單 — 僅允許備份還原所需的語句
        const ALLOWED_SQL_PREFIXES = [
            'INSERT INTO',
            'DELETE FROM',
            'TRUNCATE TABLE',
            'TRUNCATE',
            'SET CONSTRAINTS',
            'SET STATEMENT_TIMEOUT',
            'SET LOCK_TIMEOUT',
        ];

        // 過濾與驗證所有語句類型
        const filteredStatements: string[] = [];
        for (const statement of statements) {
            if (!statement) continue;

            const upper = statement.toUpperCase().trimStart();

            // 略過 BEGIN/COMMIT（由 Prisma $transaction 管理交易邊界）
            if (upper === 'BEGIN' || upper === 'COMMIT') continue;

            // 略過 session_replication_role 設定（一般帳號無權限，改用 DISABLE TRIGGER）
            if (/SET\s+session_replication_role/i.test(statement)) continue;

            const isAllowed = ALLOWED_SQL_PREFIXES.some(prefix => upper.startsWith(prefix));
            if (!isAllowed) {
                return NextResponse.json({
                    error: `SQL 包含不允許的語句類型，已中止還原。問題語句：${statement.slice(0, 80)}...`
                }, { status: 400 });
            }

            filteredStatements.push(statement);
        }

        // 6. 在 Prisma interactive transaction 內執行還原
        //    - 使用 DISABLE TRIGGER ALL 停用所有 FK 觸發器，避免插入順序問題
        //    - 整個操作具原子性：全部成功或全部回滾
        //    - 不需要 superuser 權限（表擁有者即可操作）

        // 需要停用/啟用觸發器的所有資料表
        const ALL_TABLES = [
            'User', 'ProjectCategory', 'Project', 'Item',
            'ItemRelation', 'ItemReference', 'ChangeRequest', 'ItemHistory',
            'QCDocumentApproval', 'QCDocumentRevision',
            'DataFile', 'DataFileChangeRequest', 'DataFileHistory',
            'Notification', 'LoginLog',
        ];

        await prisma.$transaction(async (tx) => {
            // 停用所有表的觸發器（含 FK 約束檢查）
            for (const table of ALL_TABLES) {
                await tx.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`);
            }

            // 執行所有 TRUNCATE + DELETE + INSERT 語句
            for (const stmt of filteredStatements) {
                await tx.$executeRawUnsafe(stmt);
            }

            // 重新啟用所有表的觸發器
            for (const table of ALL_TABLES) {
                await tx.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`);
            }
        }, {
            maxWait: 30000,   // 等待取得連線的最大時間 (30 秒)
            timeout: 600000,  // 交易執行的最大時間 (10 分鐘)
        });

        // 6. 強制登出所有使用者
        await forceLogoutAllUsers();

        return NextResponse.json({
            success: true,
            message: '資料庫復原成功！所有使用者已登出，請重新登入。',
            stats: manifestStats,
            fileType: file.name.endsWith('.sql') ? 'sql' : 'zip',
        });
    } catch (error) {
        console.error('Database restore error:', error);
        return NextResponse.json(
            { error: '復原失敗: ' + (error instanceof Error ? error.message : '未知錯誤') },
            { status: 500 }
        );
    }
}
