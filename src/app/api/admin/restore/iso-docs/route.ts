/**
 * @file route.ts (api/admin/restore/iso-docs)
 * @description 管理員 - ISO 文件實體還原 API 路由
 *
 * 解壓縮備份包並將 PDF 文件還原至 `public/iso_doc` 目錄。
 *
 * ## 核心功能
 * - 解壓縮 ZIP 檔案
 * - 驗證 `manifest.json` 類型 (必須為 iso-docs)
 * - 覆蓋式還原實體檔案
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // 1. 權限驗證
        const session = await getServerSession(authOptions);
        if (!session || !session.user || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: '權限不足，僅限管理員操作' }, { status: 403 });
        }

        // 2. 讀取上傳的 ZIP 檔案
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: '請選擇備份檔案' }, { status: 400 });
        }

        // 3. 儲存到暫存目錄
        const tempDir = path.join(os.tmpdir(), `rms-restore-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        const zipPath = path.join(tempDir, 'backup.zip');
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(zipPath, buffer);

        // 4. 解壓縮（含 Zip Slip 防護）
        const zip = new AdmZip(zipPath);
        const resolvedTempDir = path.resolve(tempDir);
        for (const entry of zip.getEntries()) {
            const resolvedTarget = path.resolve(tempDir, entry.entryName);
            if (!resolvedTarget.startsWith(resolvedTempDir + path.sep) && resolvedTarget !== resolvedTempDir) {
                fs.rmSync(tempDir, { recursive: true });
                return NextResponse.json({ error: '備份檔案包含不安全的路徑，已中止還原' }, { status: 400 });
            }
        }
        zip.extractAllTo(tempDir, true);

        // 5. 驗證 manifest.json
        const manifestPath = path.join(tempDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            fs.rmSync(tempDir, { recursive: true });
            return NextResponse.json({ error: '無效的備份檔案：缺少 manifest.json' }, { status: 400 });
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (manifest.backupType !== 'iso-docs') {
            fs.rmSync(tempDir, { recursive: true });
            return NextResponse.json({ error: '無效的備份檔案：這不是 ISO 文件備份' }, { status: 400 });
        }

        // 6. 檢查 iso_doc 目錄
        const isoDocBackupDir = path.join(tempDir, 'iso_doc');
        if (!fs.existsSync(isoDocBackupDir)) {
            fs.rmSync(tempDir, { recursive: true });
            return NextResponse.json({ error: '無效的備份檔案：缺少 iso_doc 目錄' }, { status: 400 });
        }

        // 7. 目標目錄
        const targetDir = path.join(process.cwd(), 'public', 'iso_doc');

        // 8. 清空目標目錄
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true });
        }
        fs.mkdirSync(targetDir, { recursive: true });

        // 9. 複製檔案
        copyRecursive(isoDocBackupDir, targetDir);

        // 10. 清理暫存檔案
        fs.rmSync(tempDir, { recursive: true });

        return NextResponse.json({
            success: true,
            message: 'ISO 文件復原成功！',
            stats: manifest.stats,
        });
    } catch (error) {
        console.error('ISO docs restore error:', error);
        return NextResponse.json(
            { error: '復原失敗: ' + (error instanceof Error ? error.message : '未知錯誤') },
            { status: 500 }
        );
    }
}

/**
 * 遞迴複製目錄（含 symlink 防護與路徑邊界檢查）
 */
function copyRecursive(src: string, dest: string): void {
    const resolvedDest = path.resolve(dest);
    const items = fs.readdirSync(src);
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);

        // 使用 lstatSync 偵測 symlink，跳過以防止路徑穿越
        const stat = fs.lstatSync(srcPath);
        if (stat.isSymbolicLink()) continue;

        // 確認目標路徑在允許範圍內
        const resolvedTarget = path.resolve(destPath);
        if (!resolvedTarget.startsWith(resolvedDest + path.sep) && resolvedTarget !== resolvedDest) {
            throw new Error(`路徑穿越偵測: ${destPath}`);
        }

        if (stat.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
