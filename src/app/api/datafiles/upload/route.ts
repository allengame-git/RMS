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
    // 已移除 application/octet-stream — 此通用類型會使白名單失效
    // AutoCAD 檔案請使用 application/acad 或 image/vnd.dwg
];

/** MIME 類型與副檔名的對應表，用於驗證上傳檔案的一致性 */
const MIME_EXTENSION_MAP: Record<string, string[]> = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'text/plain': ['.txt', '.csv', '.log'],
    'text/csv': ['.csv'],
    'application/json': ['.json'],
    'application/xml': ['.xml'],
    'text/xml': ['.xml'],
    'application/zip': ['.zip'],
    'application/x-zip-compressed': ['.zip'],
    'application/x-rar-compressed': ['.rar'],
    'application/x-7z-compressed': ['.7z'],
    'application/x-tar': ['.tar'],
    'application/gzip': ['.gz', '.tgz'],
    'application/acad': ['.dwg', '.dxf'],
    'image/vnd.dwg': ['.dwg'],
};

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

        // 嚴格驗證 dataYear 格式，防止路徑遍歷攻擊
        if (!/^\d{4}$/.test(dataYear) || parseInt(dataYear) < 1900 || parseInt(dataYear) > 2100) {
            return NextResponse.json({ error: '無效的資料年份格式' }, { status: 400 });
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: `檔案大小超過限制 (最大 100MB)`
            }, { status: 400 });
        }

        // Validate file type against whitelist (空 MIME 也拒絕)
        if (!file.type || !ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({
                error: `不支援的檔案類型：${file.type}`
            }, { status: 400 });
        }

        // Validate MIME-to-extension consistency
        const ext = path.extname(file.name).toLowerCase();
        const allowedExts = MIME_EXTENSION_MAP[file.type];
        if (!allowedExts || !allowedExts.includes(ext)) {
            return NextResponse.json({
                error: `檔案類型與副檔名不一致：${file.type} / ${ext}`
            }, { status: 400 });
        }

        // Get file extension
        const originalName = file.name;

        // Generate safe unique filename using UUID to avoid OS encoding issues
        const uuidName = `${crypto.randomUUID()}${ext}`;

        // Create unique subdirectory with timestamp to avoid filename conflicts
        const timestamp = Date.now();
        const subDir = timestamp.toString(36);
        const userId = session.user.id;

        // Create year/userId/subdir directory if not exists
        const yearDir = path.join(process.cwd(), 'public', 'uploads', 'datafiles', dataYear, userId, subDir);

        // 路徑邊界檢查：確保解析後的路徑仍在允許的目錄內
        const baseDir = path.resolve(process.cwd(), 'public', 'uploads', 'datafiles');
        const resolvedYearDir = path.resolve(yearDir);
        if (!resolvedYearDir.startsWith(baseDir + path.sep)) {
            return NextResponse.json({ error: '無效的檔案路徑' }, { status: 400 });
        }

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
            mimeType: file.type
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({
            error: '檔案上傳失敗'
        }, { status: 500 });
    }
}
