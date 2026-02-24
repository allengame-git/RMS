import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * @file route.ts (uploads/[...path])
 * @description 檔案下載代理路由
 * 
 * 解決 Windows 生產環境下 public/uploads 動態建立的檔案無法透過靜態 URL 存取的問題。
 */

const MIME_TYPES: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const resolvedParams = await params;
        const subPaths = resolvedParams.path;

        // Path Traversal Protection: Ensure we stay within public/uploads
        // 1. Sanitize each segment (remove .. and separators)
        const sanitizedPaths = subPaths.map(p => path.basename(p));

        // 2. Resolve absolute path
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        const filePath = path.join(uploadsDir, ...sanitizedPaths);

        // 3. Strict directory traversal check
        const resolvedUploadsDir = path.resolve(uploadsDir);
        const resolvedFilePath = path.resolve(filePath);

        if (!resolvedFilePath.startsWith(resolvedUploadsDir)) {
            console.error('[Uploads Proxy API] Path traversal attempt blocked:', filePath);
            return new NextResponse('Forbidden', { status: 403 });
        }

        console.log('[Uploads Proxy API] Attempting to read file:', filePath);

        if (!existsSync(filePath)) {
            console.error('[Uploads Proxy API] File not found on disk:', filePath);
            return new NextResponse('File Not Found', { status: 404 });
        }

        const fileBuffer = await readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const headers = new Headers();
        headers.set('Content-Type', contentType);
        const fileName = path.basename(filePath);
        const encodedFileName = encodeURIComponent(fileName);

        // SVG must be served as attachment (can contain <script> tags — XSS risk)
        // All non-image types and SVGs are forced download
        if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') {
            headers.set('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`);
        } else {
            headers.set('Content-Disposition', `inline; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`);
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('[Uploads Proxy API] Error serving file:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
