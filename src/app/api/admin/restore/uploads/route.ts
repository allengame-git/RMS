/**
 * @file route.ts (api/admin/restore/uploads)
 * @description 管理員 - 使用者附件還原 API 路由
 *
 * 解壓縮備份包並將附件還原至 `public/uploads` 目錄。
 *
 * ## 核心功能
 * - 使用 unzipper 串流解壓，避免大檔案佔用雙倍記憶體
 * - 支援多階層目錄還原
 * - 自動修正 `static/` 資源位置
 * - 驗證 `manifest.json` 類型
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import unzipper from 'unzipper';
import path from 'path';
import fs from 'fs';

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

        const buffer = Buffer.from(await file.arrayBuffer());

        // 3. 使用 unzipper 隨機存取模式開啟 ZIP
        const directory = await unzipper.Open.buffer(buffer);

        // 4. 先讀取並驗證 manifest.json
        const manifestEntry = directory.files.find(f => f.path === 'manifest.json');
        if (!manifestEntry) {
            return NextResponse.json({ error: '無效的備份檔案：缺少 manifest.json' }, { status: 400 });
        }

        const manifestBuffer = await manifestEntry.buffer();
        const manifest = JSON.parse(manifestBuffer.toString('utf-8'));
        if (manifest.backupType !== 'uploads') {
            return NextResponse.json({ error: '無效的備份檔案：這不是上傳檔案備份' }, { status: 400 });
        }

        // 5. 驗證是否包含 uploads 目錄下的檔案
        const uploadFiles = directory.files.filter(
            f => f.path.startsWith('uploads/') && f.type === 'File'
        );
        if (uploadFiles.length === 0) {
            return NextResponse.json({ error: '無效的備份檔案：缺少 uploads 目錄' }, { status: 400 });
        }

        // 6. 清空並重建目標目錄
        const targetDir = path.join(process.cwd(), 'public', 'uploads');
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true });
        }
        fs.mkdirSync(targetDir, { recursive: true });

        // 7. 直接從 ZIP 解壓 uploads/ 到目標目錄
        const resolvedTargetDir = path.resolve(targetDir);
        let restoredCount = 0;

        for (const entry of uploadFiles) {
            const relativePath = entry.path.slice('uploads/'.length);
            if (!relativePath) continue;

            const destPath = path.join(targetDir, relativePath);

            // Zip Slip 防護
            const resolvedDest = path.resolve(destPath);
            if (!resolvedDest.startsWith(resolvedTargetDir + path.sep) && resolvedDest !== resolvedTargetDir) {
                throw new Error(`路徑穿越偵測: ${entry.path}`);
            }

            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            const content = await entry.buffer();
            fs.writeFileSync(destPath, content);
            restoredCount++;
        }

        // 8. 還原靜態資源 (static/ 目錄下的檔案複製到 public/)
        const staticFiles = directory.files.filter(
            f => f.path.startsWith('static/') && f.type === 'File'
        );
        const publicDir = path.join(process.cwd(), 'public');
        const resolvedPublicDir = path.resolve(publicDir);

        for (const entry of staticFiles) {
            const relativePath = entry.path.slice('static/'.length);
            if (!relativePath) continue;

            const destPath = path.join(publicDir, relativePath);

            // 路徑邊界檢查（只允許 public/ 根目錄下的檔案）
            const resolvedDest = path.resolve(destPath);
            if (!resolvedDest.startsWith(resolvedPublicDir + path.sep) && resolvedDest !== resolvedPublicDir) {
                continue;
            }

            // 只還原檔案（不遞迴子目錄，避免覆蓋其他資源）
            if (!relativePath.includes('/')) {
                const content = await entry.buffer();
                fs.writeFileSync(destPath, content);
            }
        }

        return NextResponse.json({
            success: true,
            message: `上傳檔案復原成功！已還原 ${restoredCount} 個檔案。` +
                (staticFiles.length > 0 ? '（含靜態資源）' : ''),
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
