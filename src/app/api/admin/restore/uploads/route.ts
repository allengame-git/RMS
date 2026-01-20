import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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

        // 2. 讀取上傳的 ZIP 檔案
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: '請選擇備份檔案' }, { status: 400 });
        }

        // 3. 儲存到暫存目錄
        const tempDir = path.join(os.tmpdir(), `rms-restore-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        const zipPath = path.join(tempDir, 'backup.zip');
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(zipPath, buffer);

        // 4. 解壓縮
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(tempDir, true);

        // 5. 驗證 manifest.json
        const manifestPath = path.join(tempDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            fs.rmSync(tempDir, { recursive: true });
            return NextResponse.json({ error: '無效的備份檔案：缺少 manifest.json' }, { status: 400 });
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (manifest.backupType !== 'uploads') {
            fs.rmSync(tempDir, { recursive: true });
            return NextResponse.json({ error: '無效的備份檔案：這不是上傳檔案備份' }, { status: 400 });
        }

        // 6. 檢查 uploads 目錄
        const uploadsBackupDir = path.join(tempDir, 'uploads');
        if (!fs.existsSync(uploadsBackupDir)) {
            fs.rmSync(tempDir, { recursive: true });
            return NextResponse.json({ error: '無效的備份檔案：缺少 uploads 目錄' }, { status: 400 });
        }

        // 7. 目標目錄
        const targetDir = path.join(process.cwd(), 'public', 'uploads');

        // 8. 備份現有檔案（可選，這裡直接覆蓋）
        // 清空目標目錄
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true });
        }
        fs.mkdirSync(targetDir, { recursive: true });

        // 9. 複製檔案
        copyRecursive(uploadsBackupDir, targetDir);

        // 10. 檢查並還原靜態資源 (static 目錄)
        const staticBackupDir = path.join(tempDir, 'static');
        if (fs.existsSync(staticBackupDir)) {
            const publicDir = path.join(process.cwd(), 'public');
            const staticFiles = fs.readdirSync(staticBackupDir);
            for (const file of staticFiles) {
                const srcPath = path.join(staticBackupDir, file);
                const destPath = path.join(publicDir, file);
                if (fs.statSync(srcPath).isFile()) {
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        }

        // 11. 清理暫存檔案
        fs.rmSync(tempDir, { recursive: true });

        return NextResponse.json({
            success: true,
            message: '上傳檔案復原成功！' + (fs.existsSync(staticBackupDir) ? '（含靜態資源）' : ''),
            stats: manifest.stats,
        });
    } catch (error) {
        console.error('Uploads restore error:', error);
        return NextResponse.json(
            { error: '復原失敗: ' + (error instanceof Error ? error.message : '未知錯誤') },
            { status: 500 }
        );
    }
}

/**
 * 遞迴複製目錄
 */
function copyRecursive(src: string, dest: string): void {
    const items = fs.readdirSync(src);
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
