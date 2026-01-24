/**
 * @file route.ts (api/admin/backup/iso-docs)
 * @description 管理員 - ISO 文件實體檔案備份 API 路由
 *
 * 將伺服器上 `public/iso_doc` 目錄下的所有 PDF 文件打包成 ZIP 下載。
 *
 * ## 核心功能
 * - 計算目錄總大小與檔案總數
 * - 打包整個 ISO 存放路徑
 * - 生成帶有檔案指紋 (checksum) 的清單 (Manifest)
 *
 * @see /src/lib/backup-utils.ts - 生成 Manifest 工具
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateFileManifest } from '@/lib/backup-utils';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

/**
 * 遞迴計算目錄統計資訊（大小與檔案數）
 * @param dirPath 目錄絕對路徑
 */
function getDirectoryStats(dirPath: string): { fileCount: number; totalSize: number } {
    let fileCount = 0;
    let totalSize = 0;

    if (!fs.existsSync(dirPath)) {
        return { fileCount: 0, totalSize: 0 };
    }

    const items = fs.readdirSync(dirPath);
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
            const subStats = getDirectoryStats(itemPath);
            fileCount += subStats.fileCount;
            totalSize += subStats.totalSize;
        } else {
            fileCount++;
            totalSize += stat.size;
        }
    }

    return { fileCount, totalSize };
}

export async function POST() {
    try {
        // 1. 權限驗證
        const session = await getServerSession(authOptions);
        if (!session || !session.user || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: '權限不足，僅限管理員操作' }, { status: 403 });
        }

        // 2. 生成時間戳
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const filename = `isodocs-${dateStr}.zip`;

        // 3. 檢查目錄
        const isoDocDir = path.join(process.cwd(), 'public', 'iso_doc');
        if (!fs.existsSync(isoDocDir)) {
            // 如果目錄不存在，建立空目錄並回傳空備份
            fs.mkdirSync(isoDocDir, { recursive: true });
        }

        // 4. 計算統計資訊
        const stats = getDirectoryStats(isoDocDir);
        const manifest = generateFileManifest('iso-docs', stats.fileCount, stats.totalSize);

        // 5. 建立 ZIP 檔案
        const archive = archiver('zip', { zlib: { level: 6 } });
        const passthrough = new PassThrough();

        archive.pipe(passthrough);

        // 加入 iso_doc 目錄
        archive.directory(isoDocDir, 'iso_doc');

        // 加入 manifest.json
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

        // 完成壓縮
        archive.finalize();

        // 6. 轉換為 Web Stream
        const readable = new ReadableStream({
            start(controller) {
                passthrough.on('data', (chunk) => {
                    controller.enqueue(chunk);
                });
                passthrough.on('end', () => {
                    controller.close();
                });
                passthrough.on('error', (err) => {
                    controller.error(err);
                });
            },
        });

        // 7. 回傳下載
        const encodedFilename = encodeURIComponent(filename);
        return new Response(readable, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
            },
        });
    } catch (error) {
        console.error('ISO docs backup error:', error);
        return NextResponse.json(
            { error: '備份失敗: ' + (error instanceof Error ? error.message : '未知錯誤') },
            { status: 500 }
        );
    }
}
