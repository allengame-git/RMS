/**
 * @file route.ts (api/iso-docs/[projectId]/download-all)
 * @description 依專案 ID 打包所有品質文件 PDF 成 ZIP 下載
 *
 * 檔名格式：WQ-ISO-YYYYMMDD.zip
 * 只包含 isoDocPath 不為 null 的文件。
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

type Params = Promise<{ projectId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
    try {
        // 1. 權限驗證
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: '請先登入' }, { status: 401 });
        }

        const { projectId } = await params;
        const projectIdNum = parseInt(projectId, 10);
        if (isNaN(projectIdNum)) {
            return NextResponse.json({ error: '無效的專案 ID' }, { status: 400 });
        }

        // 2. 確認專案存在
        const project = await prisma.project.findUnique({
            where: { id: projectIdNum },
            select: { id: true, title: true, codePrefix: true },
        });
        if (!project) {
            return NextResponse.json({ error: '找不到專案' }, { status: 404 });
        }

        // 3. 查詢所有有 PDF 的品質文件
        const docs = await prisma.itemHistory.findMany({
            where: {
                item: { projectId: projectIdNum },
                isoDocPath: { not: null },
            },
            select: {
                id: true,
                isoDocPath: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        if (docs.length === 0) {
            return NextResponse.json({ error: '此專案沒有任何品質文件可下載' }, { status: 404 });
        }

        // 4. 生成時間戳與檔名
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const filename = `WQ-ISO-${dateStr}.zip`;

        // 5. 建立 ZIP
        const archive = archiver('zip', { zlib: { level: 6 } });
        const passthrough = new PassThrough();
        archive.pipe(passthrough);

        const basePath = process.cwd();
        let addedCount = 0;
        let seq = 1;

        for (const doc of docs) {
            if (!doc.isoDocPath) continue;

            // isoDocPath 格式：/iso_doc/xxx.pdf (相對於 public/)
            const absolutePath = path.join(basePath, 'public', doc.isoDocPath);

            if (!fs.existsSync(absolutePath)) continue;

            // zip 內檔名：序號_原始檔名
            const originalName = path.basename(doc.isoDocPath);
            const zipEntryName = `${seq}_${originalName}`;

            archive.file(absolutePath, { name: zipEntryName });
            addedCount++;
            seq++;
        }

        if (addedCount === 0) {
            return NextResponse.json({ error: '找不到任何 PDF 實體檔案' }, { status: 404 });
        }

        archive.finalize();

        // 6. 轉為 Web Stream 回傳
        const readable = new ReadableStream({
            start(controller) {
                passthrough.on('data', (chunk) => controller.enqueue(chunk));
                passthrough.on('end', () => controller.close());
                passthrough.on('error', (err) => controller.error(err));
            },
        });

        const encodedFilename = encodeURIComponent(filename);
        return new Response(readable, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
            },
        });
    } catch (error) {
        console.error('ISO docs download-all error:', error);
        return NextResponse.json(
            { error: '打包失敗: ' + (error instanceof Error ? error.message : '未知錯誤') },
            { status: 500 }
        );
    }
}
