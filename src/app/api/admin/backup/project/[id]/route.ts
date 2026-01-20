/**
 * 單一專案備份 API
 * POST /api/admin/backup/project/[id]
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { exportProjectToZip } from '@/lib/backup/export-service';
import { prisma } from '@/lib/prisma';
import { PassThrough } from 'stream';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 驗證管理員權限
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
        }

        const { id } = await params;
        const projectId = parseInt(id, 10);

        if (isNaN(projectId)) {
            return NextResponse.json({ error: '無效的專案 ID' }, { status: 400 });
        }

        // 檢查專案是否存在
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { codePrefix: true, title: true },
        });

        if (!project) {
            return NextResponse.json({ error: '專案不存在' }, { status: 404 });
        }

        // 建立串流
        const passThrough = new PassThrough();
        const chunks: Buffer[] = [];

        passThrough.on('data', (chunk) => chunks.push(chunk));

        // 匯出專案
        await exportProjectToZip(projectId, passThrough);

        // 組合 Buffer
        const zipBuffer = Buffer.concat(chunks);

        // 產生檔名
        const date = new Date().toISOString().split('T')[0];
        const filename = `project_${project.codePrefix}_backup_${date}.zip`;

        // 回傳 ZIP 檔案
        return new NextResponse(zipBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': zipBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('專案備份失敗:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '備份失敗' },
            { status: 500 }
        );
    }
}
