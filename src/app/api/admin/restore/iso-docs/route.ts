/**
 * @file route.ts (api/admin/restore/iso-docs)
 * @description 管理員 - ISO 文件實體還原 API 路由
 *
 * 解壓縮備份包並將 PDF 文件還原至 `public/iso_doc` 目錄。
 *
 * ## 核心功能
 * - 使用 unzipper 串流解壓，避免大檔案佔用雙倍記憶體
 * - 驗證 `manifest.json` 類型 (必須為 iso-docs)
 * - 直接解壓到目標目錄，省去暫存複製步驟
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

        // 3. 使用 unzipper 隨機存取模式開啟 ZIP（不需解壓全部到暫存）
        const directory = await unzipper.Open.buffer(buffer);

        // 4. 先讀取並驗證 manifest.json
        const manifestEntry = directory.files.find(f => f.path === 'manifest.json');
        if (!manifestEntry) {
            return NextResponse.json({ error: '無效的備份檔案：缺少 manifest.json' }, { status: 400 });
        }

        const manifestBuffer = await manifestEntry.buffer();
        const manifest = JSON.parse(manifestBuffer.toString('utf-8'));
        if (manifest.backupType !== 'iso-docs') {
            return NextResponse.json({ error: '無效的備份檔案：這不是 ISO 文件備份' }, { status: 400 });
        }

        // 5. 驗證是否包含 iso_doc 目錄下的檔案
        const isoDocFiles = directory.files.filter(
            f => f.path.startsWith('iso_doc/') && f.type === 'File'
        );
        if (isoDocFiles.length === 0) {
            return NextResponse.json({ error: '無效的備份檔案：缺少 iso_doc 目錄' }, { status: 400 });
        }

        // 6. 清空並重建目標目錄
        const targetDir = path.join(process.cwd(), 'public', 'iso_doc');
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true });
        }
        fs.mkdirSync(targetDir, { recursive: true });

        // 7. 直接從 ZIP 串流解壓到目標目錄
        const resolvedTargetDir = path.resolve(targetDir);
        let restoredCount = 0;

        for (const entry of isoDocFiles) {
            // 取得相對於 iso_doc/ 的路徑
            const relativePath = entry.path.slice('iso_doc/'.length);
            if (!relativePath) continue;

            const destPath = path.join(targetDir, relativePath);

            // Zip Slip 防護
            const resolvedDest = path.resolve(destPath);
            if (!resolvedDest.startsWith(resolvedTargetDir + path.sep) && resolvedDest !== resolvedTargetDir) {
                throw new Error(`路徑穿越偵測: ${entry.path}`);
            }

            // 確保父目錄存在
            fs.mkdirSync(path.dirname(destPath), { recursive: true });

            // 串流寫入檔案
            const content = await entry.buffer();
            fs.writeFileSync(destPath, content);
            restoredCount++;
        }

        return NextResponse.json({
            success: true,
            message: `ISO 文件復原成功！已還原 ${restoredCount} 個檔案。`,
            stats: manifest.stats,
        });
    } catch (error) {
        console.error('ISO docs restore error:', error);
        return NextResponse.json(
            { error: '復原失敗: ' + (error instanceof Error ? error.message : '未知錯誤') },
            { status: 500 }
        );
    }
}
