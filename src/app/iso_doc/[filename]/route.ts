import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import path from 'path';
import { createReadStream, existsSync, statSync } from 'fs';
import { Readable } from 'stream';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { filename } = await params;

        // Path Traversal Protection
        // 1. Sanitize filename
        const safeFilename = path.basename(filename);

        // 2. Resolve paths
        const isoDocsDir = path.join(process.cwd(), 'public', 'iso_doc');
        const filePath = path.join(isoDocsDir, safeFilename);

        // 3. Strict directory traversal check
        const resolvedIsoDocsDir = path.resolve(isoDocsDir);
        const resolvedFilePath = path.resolve(filePath);

        if (!resolvedFilePath.startsWith(resolvedIsoDocsDir)) {
            console.error('[ISO-Doc Proxy API] Path traversal attempt blocked:', filePath);
            return new NextResponse('Forbidden', { status: 403 });
        }

        console.log('[ISO-Doc Proxy API] Attempting to read file:', filePath);

        if (!existsSync(filePath)) {
            console.error('[ISO-Doc Proxy API] File not found on disk:', filePath);
            return new NextResponse('File Not Found', { status: 404 });
        }

        const stat = statSync(filePath);

        // Determine Content-Type
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Length', stat.size.toString());
        headers.set('Content-Disposition', `inline; filename="${safeFilename}"`);

        const stream = createReadStream(filePath);
        const webStream = Readable.toWeb(stream) as ReadableStream;

        return new Response(webStream, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('[ISO-Doc Proxy API] Error serving file:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
