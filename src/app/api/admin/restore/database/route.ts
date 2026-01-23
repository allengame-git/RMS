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
            console.log('📄 直接讀取 SQL 檔案:', file.name);
        } else if (file.name.endsWith('.zip')) {
            // 處理 ZIP 檔案（原有邏輯）
            const tempDir = path.join(os.tmpdir(), `rms-restore-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });

            const zipPath = path.join(tempDir, 'backup.zip');
            fs.writeFileSync(zipPath, buffer);

            // 解壓縮
            const zip = new AdmZip(zipPath);
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
            console.log('📦 從 ZIP 檔案讀取 SQL:', file.name);
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

        console.log('📊 備份檔案驗證通過：');
        console.log(`  - 總 INSERT 語句數: ${insertMatches.length}`);
        console.log(`  - 使用者記錄數: ${userInsertMatches.length}`);
        console.log(`  - 管理員帳號數: ${adminInsertMatches.length}`);

        // 5. 執行 SQL (使用 $executeRawUnsafe 逐行執行)
        const statements = sql
            .split(';\n')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--'));

        for (const statement of statements) {
            if (statement) {
                try {
                    await prisma.$executeRawUnsafe(statement);
                } catch (err) {
                    console.error('SQL execution error:', statement.slice(0, 100), err);
                    // 繼續執行，不中斷
                }
            }
        }

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
