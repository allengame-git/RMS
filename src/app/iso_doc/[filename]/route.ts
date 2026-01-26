import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

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
        const safeFilename = path.basename(filename);
        const filePath = path.join(process.cwd(), 'public', 'iso_doc', safeFilename);

        console.log('[ISO-Doc Proxy API] Attempting to read file:', filePath);

        if (!existsSync(filePath)) {
            console.error('[ISO-Doc Proxy API] File not found on disk:', filePath);
            return new NextResponse('File Not Found', { status: 404 });
        }

        const fileBuffer = await readFile(filePath);

        // Determine Content-Type
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Disposition', `inline; filename="${safeFilename}"`);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('[ISO-Doc Proxy API] Error serving file:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
