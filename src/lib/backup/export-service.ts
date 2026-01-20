/**
 * Project Export Service
 * 
 * 處理單一專案的完整匯出，包含所有關聯資料與檔案
 */

import { prisma } from '@/lib/prisma';
import archiver from 'archiver';
import { createHash } from 'crypto';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';
import { Writable } from 'stream';

// 系統版本，用於相容性檢查
const SYSTEM_VERSION = '1.0.0';

interface ExportManifest {
    version: string;
    exportedAt: string;
    projectId: number;
    projectCodePrefix: string;
    projectTitle: string;
    counts: {
        items: number;
        itemRelations: number;
        itemReferences: number;
        changeRequests: number;
        itemHistories: number;
        qcApprovals: number;
        qcRevisions: number;
        dataFiles: number;
        dataFileChangeRequests: number;
        dataFileHistories: number;
    };
    files: Array<{
        path: string;
        checksum: string;
        size: number;
    }>;
}

interface ExportData {
    projectCategory: object | null;
    project: object;
    items: object[];
    itemRelations: object[];
    dataFiles: object[];
    itemReferences: object[];
    changeRequests: object[];
    itemHistories: object[];
    qcDocumentApprovals: object[];
    qcDocumentRevisions: object[];
    dataFileChangeRequests: object[];
    dataFileHistories: object[];
}

/**
 * 計算檔案 MD5 checksum
 */
async function calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash('md5');
        const stream = createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

/**
 * 序列化資料，處理 BigInt 和 Date 類型
 */
function serializeData(data: unknown): unknown {
    return JSON.parse(
        JSON.stringify(data, (_, value) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        })
    );
}

/**
 * 收集專案的所有檔案路徑
 */
async function collectProjectFiles(
    projectId: number,
    items: Array<{ attachments: string | null }>,
    itemHistories: Array<{ isoDocPath: string | null }>,
    dataFiles: Array<{ filePath: string }>
): Promise<Array<{ sourcePath: string; zipPath: string }>> {
    const files: Array<{ sourcePath: string; zipPath: string }> = [];
    const basePath = process.cwd();

    // 1. Item 附件
    for (const item of items) {
        if (item.attachments) {
            try {
                const attachments = JSON.parse(item.attachments) as Array<{ path: string }>;
                for (const att of attachments) {
                    const sourcePath = path.join(basePath, 'public', att.path);
                    if (existsSync(sourcePath)) {
                        files.push({
                            sourcePath,
                            zipPath: `assets/uploads/${path.basename(att.path)}`,
                        });
                    }
                }
            } catch {
                // 忽略解析錯誤
            }
        }
    }

    // 2. QC 文件 (ISO PDF)
    for (const history of itemHistories) {
        if (history.isoDocPath) {
            const sourcePath = path.join(basePath, 'public', history.isoDocPath);
            if (existsSync(sourcePath)) {
                files.push({
                    sourcePath,
                    zipPath: `assets/iso_doc/${path.basename(history.isoDocPath)}`,
                });
            }
        }
    }

    // 3. DataFile 檔案
    for (const dataFile of dataFiles) {
        if (dataFile.filePath) {
            const sourcePath = path.join(basePath, 'public', dataFile.filePath);
            if (existsSync(sourcePath)) {
                files.push({
                    sourcePath,
                    zipPath: `assets/uploads/datafiles/${path.basename(dataFile.filePath)}`,
                });
            }
        }
    }

    return files;
}

/**
 * 匯出單一專案的所有資料
 */
export async function exportProjectData(projectId: number): Promise<ExportData> {
    // 1. 取得專案
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { category: true },
    });

    if (!project) {
        throw new Error(`專案 ID ${projectId} 不存在`);
    }

    // 2. 取得專案下所有 Items
    const items = await prisma.item.findMany({
        where: { projectId },
    });
    const itemIds = items.map((i) => i.id);

    // 3. 取得 Item 關聯
    const itemRelations = await prisma.itemRelation.findMany({
        where: {
            OR: [{ sourceId: { in: itemIds } }, { targetId: { in: itemIds } }],
        },
    });

    // 4. 取得 ItemReferences 與關聯的 DataFiles
    const itemReferences = await prisma.itemReference.findMany({
        where: { itemId: { in: itemIds } },
    });
    const dataFileIds = Array.from(new Set(itemReferences.map((r) => r.fileId)));

    const dataFiles = await prisma.dataFile.findMany({
        where: { id: { in: dataFileIds } },
    });

    // 5. 取得 ChangeRequests
    const changeRequests = await prisma.changeRequest.findMany({
        where: {
            OR: [{ itemId: { in: itemIds } }, { targetProjectId: projectId }, { targetParentId: { in: itemIds } }],
        },
    });

    // 6. 取得 ItemHistories
    const itemHistories = await prisma.itemHistory.findMany({
        where: { projectId },
    });
    const historyIds = itemHistories.map((h) => h.id);

    // 7. 取得 QC 審核記錄
    const qcApprovals = await prisma.qCDocumentApproval.findMany({
        where: { itemHistoryId: { in: historyIds } },
    });
    const approvalIds = qcApprovals.map((a) => a.id);

    const qcRevisions = await prisma.qCDocumentRevision.findMany({
        where: { approvalId: { in: approvalIds } },
    });

    // 8. 取得 DataFile 相關記錄
    const dataFileChangeRequests = await prisma.dataFileChangeRequest.findMany({
        where: { fileId: { in: dataFileIds } },
    });

    const dataFileHistories = await prisma.dataFileHistory.findMany({
        where: { fileId: { in: dataFileIds } },
    });

    return {
        projectCategory: project.category,
        project: { ...project, category: undefined },
        items,
        itemRelations,
        dataFiles,
        itemReferences,
        changeRequests,
        itemHistories,
        qcDocumentApprovals: qcApprovals,
        qcDocumentRevisions: qcRevisions,
        dataFileChangeRequests,
        dataFileHistories,
    };
}

/**
 * 將專案匯出為 ZIP 串流
 */
export async function exportProjectToZip(
    projectId: number,
    outputStream: Writable
): Promise<{ manifest: ExportManifest }> {
    // 取得資料
    const data = await exportProjectData(projectId);
    const project = data.project as { id: number; codePrefix: string; title: string };

    // 收集檔案
    const files = await collectProjectFiles(
        projectId,
        data.items as Array<{ attachments: string | null }>,
        data.itemHistories as Array<{ isoDocPath: string | null }>,
        data.dataFiles as Array<{ filePath: string }>
    );

    // 計算檔案 checksum
    const fileManifest: ExportManifest['files'] = [];
    for (const file of files) {
        try {
            const checksum = await calculateFileChecksum(file.sourcePath);
            const stats = statSync(file.sourcePath);
            fileManifest.push({
                path: file.zipPath,
                checksum,
                size: stats.size,
            });
        } catch {
            // 忽略無法讀取的檔案
        }
    }

    // 建立 manifest
    const manifest: ExportManifest = {
        version: SYSTEM_VERSION,
        exportedAt: new Date().toISOString(),
        projectId: project.id,
        projectCodePrefix: project.codePrefix,
        projectTitle: project.title,
        counts: {
            items: data.items.length,
            itemRelations: data.itemRelations.length,
            itemReferences: data.itemReferences.length,
            changeRequests: data.changeRequests.length,
            itemHistories: data.itemHistories.length,
            qcApprovals: data.qcDocumentApprovals.length,
            qcRevisions: data.qcDocumentRevisions.length,
            dataFiles: data.dataFiles.length,
            dataFileChangeRequests: data.dataFileChangeRequests.length,
            dataFileHistories: data.dataFileHistories.length,
        },
        files: fileManifest,
    };

    // 建立 ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(outputStream);

    // 加入 manifest.json
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // 加入 data.json
    archive.append(JSON.stringify(serializeData(data), null, 2), { name: 'data.json' });

    // 加入檔案
    for (const file of files) {
        if (existsSync(file.sourcePath)) {
            archive.file(file.sourcePath, { name: file.zipPath });
        }
    }

    await archive.finalize();

    return { manifest };
}
