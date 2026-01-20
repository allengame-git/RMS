/**
 * 專案復原 API
 * POST /api/admin/restore/project
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { importProjectFromZip, checkImportConflicts } from '@/lib/backup/import-service';
import { exportDatabaseToSQL } from '@/lib/backup-utils';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        // 驗證管理員權限
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
        }

        // 取得上傳的檔案
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const onConflict = (formData.get('onConflict') as 'rename' | 'skip') || 'rename';
        const skipAutoBackup = formData.get('skipAutoBackup') === 'true';

        if (!file) {
            return NextResponse.json({ error: '請上傳備份檔案' }, { status: 400 });
        }

        // 驗證檔案類型
        if (!file.name.endsWith('.zip')) {
            return NextResponse.json({ error: '請上傳 ZIP 格式的備份檔案' }, { status: 400 });
        }

        // 執行匯入前自動備份 (除非明確跳過)
        if (!skipAutoBackup) {
            try {
                const backupDir = path.join(process.cwd(), 'backups');
                if (!existsSync(backupDir)) {
                    mkdirSync(backupDir, { recursive: true });
                }

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = path.join(backupDir, `pre_import_${timestamp}.sql`);

                const sqlContent = await exportDatabaseToSQL();
                writeFileSync(backupPath, sqlContent);

                console.log(`匯入前自動備份已建立: ${backupPath}`);
            } catch (backupError) {
                console.warn('匯入前自動備份失敗，繼續執行匯入:', backupError);
            }
        }

        // 將 File 轉換為 Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 執行匯入
        const result = await importProjectFromZip(buffer, { onConflict });

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: '專案匯入成功',
                projectId: result.newProjectId,
                codePrefix: result.newCodePrefix,
                stats: result.stats,
            });
        } else {
            return NextResponse.json(
                { error: result.error || '匯入失敗' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('專案復原失敗:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '復原失敗' },
            { status: 500 }
        );
    }
}

/**
 * 預掃描 API - 檢查衝突
 * POST /api/admin/restore/project?action=check
 */
export async function PUT(request: NextRequest) {
    try {
        // 驗證管理員權限
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
        }

        const data = await request.json();

        if (!data.project?.codePrefix) {
            return NextResponse.json({ error: '無效的專案資料' }, { status: 400 });
        }

        const conflicts = await checkImportConflicts(data);

        return NextResponse.json({
            hasConflict: conflicts.hasConflict,
            conflicts: conflicts.conflicts,
        });
    } catch (error) {
        console.error('衝突檢查失敗:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '檢查失敗' },
            { status: 500 }
        );
    }
}
