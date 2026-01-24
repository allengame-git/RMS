/**
 * @file route.ts (api/admin/backup/uploads)
 * @description 管理員 - 使用者上傳附件備份 API 路由
 *
 * 打包伺服器上所有使用者上傳的附件 (`public/uploads`) 以及根目錄的靜態圖片資源。
 *
 * ## 核心功能
 * - 遞迴收集上傳目錄的所有層級檔案
 * - 額外收錄 public 根目錄的圖片 (Logo 等)
 * - 生成完整備份清單
 * - ZIP 壓縮並串流下載
 *
 * ## 備註
 * 為加速大型附件備份，壓縮等級設為 6。
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
 * 遞迴計算目錄大小與檔案數
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
        const filename = `uploads-${dateStr}.zip`;

        // 3. 檢查目錄
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            return NextResponse.json({ error: '上傳目錄不存在' }, { status: 404 });
        }

        // 4. 計算統計資訊
        const stats = getDirectoryStats(uploadsDir);

        // 5. 收集 public 根目錄的靜態圖片資源
        const publicDir = path.join(process.cwd(), 'public');
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
        const staticAssets: string[] = [];

        if (fs.existsSync(publicDir)) {
            const publicFiles = fs.readdirSync(publicDir);
            for (const file of publicFiles) {
                const ext = path.extname(file).toLowerCase();
                if (imageExtensions.includes(ext)) {
                    staticAssets.push(file);
                }
            }
        }

        // 計算靜態資源大小
        let staticAssetsSize = 0;
        for (const file of staticAssets) {
            const filePath = path.join(publicDir, file);
            staticAssetsSize += fs.statSync(filePath).size;
        }

        const manifest = {
            ...generateFileManifest('uploads', stats.fileCount + staticAssets.length, stats.totalSize + staticAssetsSize),
            staticAssets: staticAssets.length,
            staticAssetsSize: staticAssetsSize,
        };

        // 6. 建立 ZIP 檔案
        const archive = archiver('zip', { zlib: { level: 6 } }); // 使用較低壓縮等級加快速度
        const passthrough = new PassThrough();

        archive.pipe(passthrough);

        // 加入 uploads 目錄
        archive.directory(uploadsDir, 'uploads');

        // 加入 public 根目錄的靜態圖片
        for (const file of staticAssets) {
            archive.file(path.join(publicDir, file), { name: `static/${file}` });
        }

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
        console.error('Uploads backup error:', error);
        return NextResponse.json(
            { error: '備份失敗: ' + (error instanceof Error ? error.message : '未知錯誤') },
            { status: 500 }
        );
    }
}
