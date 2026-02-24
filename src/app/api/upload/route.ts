/**
 * @file route.ts (api/upload)
 * @description 一般檔案上傳 API 路由
 *
 * 處理系統中的通用檔案上傳，主要用於：
 * 1. 富文本編輯器中的圖片與附件上傳
 * 2. 項目變更申請中的隨附檔案
 *
 * ## 核心功能
 * - 驗證使用者權限（僅限 ADMIN, EDITOR, INSPECTOR）
 * - 驗證檔案大小（最大 20MB）
 * - 驗證檔案類型（PDF, Word, Excel, PPT, 圖片, 文字）
 * - 自動建立按年/月分類的儲存目錄
 * - 生成安全檔名並儲存至伺服器
 *
 * ## 技術細節
 * - 儲存路徑：`/public/uploads/${year}/${month}/`
 * - 防範路徑穿越攻擊 (Path Traversal)
 * - 回傳檔案在系統中的相對路徑以供資料庫儲存
 *
 * @see /src/components/editor/RichTextEditor.tsx - 呼叫此 API 上傳圖片
 * @see /src/components/upload/FileUploader.tsx - 項目附件上傳
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
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
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // SVG removed: can contain <script> tags (XSS risk)
    // Text
    'text/plain',
    'text/csv',
];

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        // Allow ADMIN, EDITOR, and INSPECTOR to upload files
        if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'EDITOR' && session.user.role !== 'INSPECTOR')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'File size exceeds 20MB limit' }, { status: 400 });
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
        }

        // Generate safe unique filename using UUID to avoid OS encoding issues
        const ext = path.extname(file.name);
        const filename = `${crypto.randomUUID()}${ext}`;

        // Create upload directory structure (year/month)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const userId = session.user.id;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', String(year), month, userId);

        console.log('[Upload] Target directory:', uploadDir);

        if (!existsSync(uploadDir)) {
            try {
                await mkdir(uploadDir, { recursive: true });
            } catch (err) {
                console.error('[Upload] Failed to create directory:', uploadDir, err);
                return NextResponse.json({ error: 'Failed to create upload directory' }, { status: 500 });
            }
        }

        // Save file
        const filepath = path.join(uploadDir, filename);
        console.log('[Upload] Saving file to:', filepath);

        try {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            await writeFile(filepath, buffer);
        } catch (err) {
            console.error('[Upload] Failed to write file:', filepath, err);
            return NextResponse.json({ error: 'Failed to write file to disk' }, { status: 500 });
        }

        // Return file info
        const publicPath = `/uploads/${year}/${month}/${userId}/${filename}`;

        return NextResponse.json({
            success: true,
            file: {
                name: file.name,
                path: publicPath,
                size: file.size,
                type: file.type,
                uploadedAt: new Date().toISOString(),
            }
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
