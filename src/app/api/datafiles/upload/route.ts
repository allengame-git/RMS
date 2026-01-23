import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// 100MB limit
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (session.user.role === 'VIEWER') {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const dataYear = formData.get('dataYear') as string;
        const _dataCode = formData.get('dataCode') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!dataYear) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: `檔案大小超過限制 (最大 100MB)`
            }, { status: 400 });
        }

        // Get file extension
        const originalName = file.name;

        // Sanitize original filename - keep the name but remove dangerous characters
        const sanitizedName = originalName.replace(/[<>:"/\\|?*]/g, '_');

        // Create unique subdirectory with timestamp to avoid filename conflicts
        const timestamp = Date.now();
        const subDir = timestamp.toString(36);

        // Create year/subdir directory if not exists
        const yearDir = path.join(process.cwd(), 'public', 'uploads', 'datafiles', dataYear, subDir);
        await mkdir(yearDir, { recursive: true });

        // Save file with original (sanitized) name
        const filePath = path.join(yearDir, sanitizedName);
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Return relative path for storage in DB
        const relativePath = `/uploads/datafiles/${dataYear}/${subDir}/${sanitizedName}`;


        return NextResponse.json({
            success: true,
            fileName: originalName,
            filePath: relativePath,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream'
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({
            error: '檔案上傳失敗'
        }, { status: 500 });
    }
}
