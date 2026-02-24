/**
 * @file route.ts (api/datafiles/upload)
 * @description 資料檔案 (參考文獻) 上傳 API 路由
 *
 * 專門處理「資料檔案」模組的檔案上傳，相較於一般上傳，此處擁有更高的容量限制。
 *
 * ## 核心功能
 * - 驗證使用者權限（非 VIEWER 即可上傳）
 * - 驗證檔案大小（最大 100MB）
 * - 依年份 (dataYear) 與隨機生成的子目錄分類儲存
 * - 保持原始檔名（經安全過濾）
 *
 * ## 技術細節
 * - 儲存路徑：`/public/uploads/datafiles/${dataYear}/${random_subdir}/${filename}`
 * - 檔案清單儲存於 `DataFile` 資料表，需經審核後才正式上架
 *
 * @see /src/components/datafile/UploadDataFileForm.tsx - 上傳表單
 * @see /src/actions/data-files.ts - 後續建立申請的 Server Action
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// 100MB limit
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Allowed MIME types for data file uploads
const ALLOWED_TYPES = [
    // PDF
    'application/pdf',
    // Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // PowerPoint
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Images (no SVG — XSS risk)
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Text / Data
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    // AutoCAD / Engineering
    'application/acad',
    'image/vnd.dwg',
    'application/octet-stream', // fallback for binary formats without specific MIME
];

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

        // Validate file type against whitelist
        if (file.type && !ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({
                error: `不支援的檔案類型：${file.type}`
            }, { status: 400 });
        }

        // Get file extension
        const originalName = file.name;

        // Generate safe unique filename using UUID to avoid OS encoding issues
        const ext = path.extname(file.name);
        const uuidName = `${crypto.randomUUID()}${ext}`;

        // Create unique subdirectory with timestamp to avoid filename conflicts
        const timestamp = Date.now();
        const subDir = timestamp.toString(36);
        const userId = session.user.id;

        // Create year/userId/subdir directory if not exists
        const yearDir = path.join(process.cwd(), 'public', 'uploads', 'datafiles', dataYear, userId, subDir);
        await mkdir(yearDir, { recursive: true });

        // Save file with UUID name
        const filePath = path.join(yearDir, uuidName);
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Return relative path for storage in DB
        const relativePath = `/uploads/datafiles/${dataYear}/${userId}/${subDir}/${uuidName}`;


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
