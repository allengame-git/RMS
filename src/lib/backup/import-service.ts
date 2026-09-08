/**
 * @file import-service.ts
 * @description 專案匯入服務模組
 *
 * 此模組處理專案備份的匯入，支援 ID 對照、衝突處理與檔案還原。
 *
 * ## 核心功能
 * - `previewProjectImport`：預覽匯入內容（不寫入資料庫）
 * - `importProjectFromZip`：執行完整匯入
 *
 * ## 匯入策略
 * ### ID 對照 (ID Mapping)
 * 由於匯入時可能與現有資料 ID 衝突，系統會：
 * 1. 為所有實體分配新 ID
 * 2. 維護舊 ID → 新 ID 的對照表
 * 3. 更新所有關聯參照
 *
 * ### 衝突處理
 * - 專案代碼重複：自動加上時間戳後綴
 * - 分區名稱重複：使用現有分區
 * - 資料檔案代碼重複：使用現有檔案或建立新版本
 *
 * ## 匯入步驟
 * 1. 解壓縮 ZIP 並驗證結構
 * 2. 檢查版本相容性
 * 3. 預覽/確認匯入內容
 * 4. 在事務中建立所有資料
 * 5. 還原檔案資源
 *
 * ## 安全考量
 * - 所有操作在單一事務中執行
 * - 失敗時自動回滾
 * - 驗證 manifest.json 的完整性
 *
 * @see /src/lib/backup/export-service.ts - 對應的匯出服務
 * @see /src/app/api/projects/import - 匯入 API 路由
 */

import { prisma } from '@/lib/prisma';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import {
    DATAFILES_URL_PREFIX,
    resolveDataFilePath,
    resolveDataFilePathSafely,
} from '@/lib/datafile-storage';

// 系統版本
const SYSTEM_VERSION = '1.0.0';

interface ImportManifest {
    version: string;
    exportedAt: string;
    projectId: number;
    projectCodePrefix: string;
    projectTitle: string;
    counts: Record<string, number>;
    files: Array<{
        path: string;
        checksum: string;
        size: number;
    }>;
}

// 使用泛型定義，讓 TypeScript 自動推斷
interface ImportData {
    projectCategory: {
        id: number;
        name: string;
        description?: string | null;
        sortOrder?: number;
    } | null;
    project: {
        id: number;
        title: string;
        description?: string | null;
        codePrefix: string;
        categoryId?: number | null;
    };
    items: Array<{
        id: number;
        fullId: string;
        title: string;
        content?: string | null;
        attachments?: string | null;
        publishedAt?: string | null;
        isDeleted: boolean;
        currentVersion: number;
        projectId: number;
        parentId?: number | null;
    }>;
    itemRelations: Array<{
        id: number;
        sourceId: number;
        targetId: number;
        description?: string | null;
    }>;
    dataFiles: Array<{
        id: number;
        dataYear: number;
        dataName: string;
        dataCode: string;
        author: string;
        description: string;
        fileName: string;
        filePath: string;
        fileSize: number;
        mimeType: string;
        isDeleted: boolean;
        currentVersion: number;
    }>;
    itemReferences: Array<{
        id: number;
        itemId: number;
        fileId: number;
        citation?: string | null;
    }>;
    changeRequests: Array<{
        id: number;
        type: string;
        status: string;
        data: string;
        itemId?: number | null;
        targetProjectId?: number | null;
        targetParentId?: number | null;
        previousRequestId?: number | null;
        submitterName?: string | null;
        reviewerName?: string | null;
        reviewNote?: string | null;
        submitReason?: string | null;
    }>;
    itemHistories: Array<{
        id: number;
        itemId?: number | null;
        version: number;
        changeType: string;
        snapshot: string;
        diff?: string | null;
        submitterName?: string | null;
        reviewerName?: string | null;
        reviewStatus: string;
        reviewNote?: string | null;
        submitReason?: string | null;
        itemFullId: string;
        itemTitle: string;
        projectId: number;
        isoDocPath?: string | null;
    }>;
    qcDocumentApprovals: Array<{
        id: number;
        itemHistoryId: number;
        status: string;
        revisionCount: number;
        qcApproverName?: string | null;
        qcApprovedAt?: string | null;
        qcNote?: string | null;
        pmApproverName?: string | null;
        pmApprovedAt?: string | null;
        pmNote?: string | null;
    }>;
    qcDocumentRevisions: Array<{
        id: number;
        approvalId: number;
        revisionNumber: number;
        requestNote: string;
        resolvedAt?: string | null;
        resolvedItemHistoryId?: number | null;
    }>;
    dataFileChangeRequests: Array<{
        id: number;
        fileId?: number | null;
        type: string;
        status: string;
        data: string;
        submitterName?: string | null;
        reviewerName?: string | null;
        reviewNote?: string | null;
        submitReason?: string | null;
    }>;
    dataFileHistories: Array<{
        id: number;
        fileId?: number | null;
        version: number;
        changeType: string;
        snapshot: string;
        diff?: string | null;
        submitterName?: string | null;
        reviewerName?: string | null;
        reviewStatus: string;
        reviewNote?: string | null;
        dataCode: string;
        dataName: string;
        dataYear: number;
    }>;
}

interface IdMapping {
    projectCategory: Map<number, number>;
    project: Map<number, number>;
    item: Map<number, number>;
    dataFile: Map<number, number>;
    changeRequest: Map<number, number>;
    itemHistory: Map<number, number>;
    qcApproval: Map<number, number>;
    qcRevision: Map<number, number>;
}

interface ImportOptions {
    onConflict: 'rename' | 'skip';
}

interface ImportResult {
    success: boolean;
    newProjectId?: number;
    newCodePrefix?: string;
    error?: string;
    stats: {
        itemsImported: number;
        filesRestored: number;
    };
}

interface ConflictCheckResult {
    hasConflict: boolean;
    conflicts: {
        codePrefix?: string;
        dataCodes?: string[];
    };
}

interface PendingFile {
    targetPath: string;
    fileData: Buffer;
    /** The DataFile that owns this asset, when the archive entry is one. */
    dataCodes?: string[];
}

interface InternalImportResult {
    result: ImportResult;
    /** DataFiles found by dataCode during the import transaction. */
    reusedDataCodes: Set<string>;
}

const DATAFILE_ASSET_PREFIX = 'assets/uploads/datafiles/';

/**
 * Return the path below `/uploads/datafiles/` after validating the stored URL.
 * DataFile URLs are deliberately kept as URL paths here; decoding them could
 * turn a literal `%2F` in a legacy filename into a path separator.
 */
function getDataFileRelativePath(filePath: string, cwd = process.cwd()): string {
    const prefix = `${DATAFILES_URL_PREFIX}/`;
    // resolveDataFilePath performs the canonical-prefix, separator, traversal,
    // and NUL checks shared by DataFile upload/download code.
    resolveDataFilePath(filePath, cwd);
    return filePath.slice(prefix.length);
}

/**
 * Resolve a DataFile archive entry to the DataFile metadata it belongs to.
 *
 * Archives created by the current exporter carry the full relative path. Old
 * archives only carry a basename, so they are accepted only when exactly one
 * DataFile has that basename. This avoids silently putting one file into an
 * arbitrary record when names collide.
 */
async function resolveDataFileAsset(
    entryName: string,
    data: ImportData,
    basePath: string,
): Promise<{ targetPath: string; dataCodes: string[] }> {
    const relativePath = entryName.slice(DATAFILE_ASSET_PREFIX.length);
    if (!relativePath) {
        throw new Error('備份檔案缺少 DataFile 檔案路徑');
    }

    try {
        // Validate the archive entry independently of data.json. This catches
        // traversal/backslash/NUL payloads even when no DataFile can match it.
        resolveDataFilePath(`${DATAFILES_URL_PREFIX}/${relativePath}`, basePath);
    } catch {
        throw new Error(`路徑穿越偵測: ${entryName}`);
    }

    const dataFilesWithPaths = data.dataFiles.flatMap((dataFile) => {
        try {
            return [{ dataFile, relativePath: getDataFileRelativePath(dataFile.filePath, basePath) }];
        } catch {
            // A malformed DataFile record is handled by the normal import
            // validation below; it must not become a basename match.
            return [];
        }
    });

    let matchingDataFiles: Array<(typeof dataFilesWithPaths)[number]>;
    if (relativePath.includes('/')) {
        // New archives preserve the complete relative path. Validate the
        // archive path itself before looking it up so `..` and separators can
        // never reach a filesystem operation, even when data.json is forged.
        matchingDataFiles = dataFilesWithPaths.filter((entry) => entry.relativePath === relativePath);
    } else {
        // A one-segment entry is the legacy flattened representation. It must
        // map by basename, never by a guessed directory.
        matchingDataFiles = dataFilesWithPaths.filter((entry) => {
            return path.posix.basename(entry.relativePath) === relativePath;
        });
    }

    // Multiple DataFile records may intentionally reference one physical
    // asset. They are not ambiguous as long as their canonical paths are the
    // same; ambiguity means that the basename could resolve to different
    // physical paths.
    const matchingPaths = new Map<string, (typeof dataFilesWithPaths)[number]>();
    for (const matchingDataFile of matchingDataFiles) {
        matchingPaths.set(matchingDataFile.relativePath, matchingDataFile);
    }

    if (matchingPaths.size === 0) {
        throw new Error(`找不到 DataFile 檔案路徑對應：${relativePath}`);
    }
    if (matchingPaths.size > 1) {
        throw new Error(`DataFile 檔案名稱對應不明確：${relativePath}`);
    }

    const canonicalPath = [...matchingPaths.values()][0].relativePath;
    const canonicalMatches = matchingDataFiles.filter((entry) => entry.relativePath === canonicalPath);
    const dataFile = canonicalMatches[0].dataFile;
    let targetPath: string;
    try {
        targetPath = await resolveDataFilePathSafely(dataFile.filePath, basePath, { allowMissing: true });
    } catch {
        throw new Error(`無效的 DataFile 檔案路徑：${dataFile.filePath}`);
    }
    return {
        targetPath,
        dataCodes: canonicalMatches.map((entry) => entry.dataFile.dataCode),
    };
}

/**
 * 生成唯一的 codePrefix
 */
async function generateUniqueCodePrefix(basePrefix: string): Promise<string> {
    let suffix = 1;
    let candidate = `${basePrefix}_imported`;

    while (await prisma.project.findUnique({ where: { codePrefix: candidate } })) {
        candidate = `${basePrefix}_imported_${suffix}`;
        suffix++;
    }

    return candidate;
}

/**
 * 重新生成 fullId
 */
function regenerateFullId(oldFullId: string, oldPrefix: string, newPrefix: string): string {
    if (oldFullId.startsWith(oldPrefix)) {
        return newPrefix + oldFullId.slice(oldPrefix.length);
    }
    return oldFullId;
}

/**
 * 預掃描檢查衝突
 */
export async function checkImportConflicts(data: ImportData): Promise<ConflictCheckResult> {
    const conflicts: ConflictCheckResult['conflicts'] = {};

    // 檢查 codePrefix 衝突
    const existingProject = await prisma.project.findUnique({
        where: { codePrefix: data.project.codePrefix },
    });
    if (existingProject) {
        conflicts.codePrefix = data.project.codePrefix;
    }

    // 檢查 dataCode 衝突
    const dataCodes = data.dataFiles.map((f) => f.dataCode);
    const existingDataFiles = await prisma.dataFile.findMany({
        where: { dataCode: { in: dataCodes } },
        select: { dataCode: true },
    });
    if (existingDataFiles.length > 0) {
        conflicts.dataCodes = existingDataFiles.map((f) => f.dataCode);
    }

    return {
        hasConflict: !!(conflicts.codePrefix || conflicts.dataCodes?.length),
        conflicts,
    };
}

/**
 * 匯入專案資料
 */
async function importProjectDataInternal(
    data: ImportData,
    options: ImportOptions
): Promise<InternalImportResult> {
    const idMapping: IdMapping = {
        projectCategory: new Map(),
        project: new Map(),
        item: new Map(),
        dataFile: new Map(),
        changeRequest: new Map(),
        itemHistory: new Map(),
        qcApproval: new Map(),
        qcRevision: new Map(),
    };

    const filesRestored = 0;
    const oldCodePrefix = data.project.codePrefix;
    let newCodePrefix = oldCodePrefix;
    const reusedDataCodes = new Set<string>();

    try {
        const result = await prisma.$transaction(async (tx) => {
            // Step 1: ProjectCategory (upsert by name)
            if (data.projectCategory) {
                const existing = await tx.projectCategory.findUnique({
                    where: { name: data.projectCategory.name },
                });
                if (existing) {
                    idMapping.projectCategory.set(data.projectCategory.id, existing.id);
                } else {
                    const created = await tx.projectCategory.create({
                        data: {
                            name: data.projectCategory.name,
                            description: data.projectCategory.description,
                            sortOrder: data.projectCategory.sortOrder ?? 0,
                        },
                    });
                    idMapping.projectCategory.set(data.projectCategory.id, created.id);
                }
            }

            // Step 2: Project
            const existingProject = await tx.project.findUnique({
                where: { codePrefix: oldCodePrefix },
            });

            if (existingProject) {
                if (options.onConflict === 'skip') {
                    return {
                        success: false,
                        error: `專案 ${oldCodePrefix} 已存在`,
                        stats: { itemsImported: 0, filesRestored: 0 },
                    };
                }
                newCodePrefix = await generateUniqueCodePrefix(oldCodePrefix);
            }

            const newProject = await tx.project.create({
                data: {
                    title: data.project.title,
                    description: data.project.description,
                    codePrefix: newCodePrefix,
                    categoryId: data.projectCategory
                        ? idMapping.projectCategory.get(data.projectCategory.id)
                        : null,
                },
            });
            idMapping.project.set(data.project.id, newProject.id);

            // Step 3: Items (按 parentId 排序，父項目先)
            const sortedItems = [...data.items].sort((a, b) => {
                if (!a.parentId && b.parentId) return -1;
                if (a.parentId && !b.parentId) return 1;
                return 0;
            });

            for (const item of sortedItems) {
                const newFullId = regenerateFullId(item.fullId, oldCodePrefix, newCodePrefix);
                const newItem = await tx.item.create({
                    data: {
                        fullId: newFullId,
                        title: item.title,
                        content: item.content,
                        attachments: item.attachments,
                        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
                        isDeleted: item.isDeleted,
                        currentVersion: item.currentVersion,
                        projectId: newProject.id,
                        parentId: item.parentId ? idMapping.item.get(item.parentId) : null,
                    },
                });
                idMapping.item.set(item.id, newItem.id);
            }

            // Step 4: ItemRelation (使用 sourceId/targetId)
            for (const relation of data.itemRelations) {
                const newSourceId = idMapping.item.get(relation.sourceId);
                const newTargetId = idMapping.item.get(relation.targetId);
                if (newSourceId && newTargetId) {
                    await tx.itemRelation.create({
                        data: {
                            sourceId: newSourceId,
                            targetId: newTargetId,
                            description: relation.description,
                        },
                    });
                }
            }

            // Step 5: DataFile (upsert by dataCode)
            for (const dataFile of data.dataFiles) {
                const existing = await tx.dataFile.findUnique({
                    where: { dataCode: dataFile.dataCode },
                });
                if (existing) {
                    idMapping.dataFile.set(dataFile.id, existing.id);
                    reusedDataCodes.add(dataFile.dataCode);
                } else {
                    const created = await tx.dataFile.create({
                        data: {
                            dataYear: dataFile.dataYear,
                            dataName: dataFile.dataName,
                            dataCode: dataFile.dataCode,
                            author: dataFile.author,
                            description: dataFile.description,
                            fileName: dataFile.fileName,
                            filePath: dataFile.filePath,
                            fileSize: dataFile.fileSize,
                            mimeType: dataFile.mimeType,
                            isDeleted: dataFile.isDeleted,
                            currentVersion: dataFile.currentVersion,
                        },
                    });
                    idMapping.dataFile.set(dataFile.id, created.id);
                }
            }

            // Step 6: ItemReference (使用 fileId)
            for (const ref of data.itemReferences) {
                const newItemId = idMapping.item.get(ref.itemId);
                const newFileId = idMapping.dataFile.get(ref.fileId);
                if (newItemId && newFileId) {
                    // 檢查是否已存在
                    const existing = await tx.itemReference.findUnique({
                        where: { itemId_fileId: { itemId: newItemId, fileId: newFileId } },
                    });
                    if (!existing) {
                        await tx.itemReference.create({
                            data: {
                                itemId: newItemId,
                                fileId: newFileId,
                                citation: ref.citation,
                            },
                        });
                    }
                }
            }

            // Step 7: ChangeRequest Phase 1 (不含 previousRequestId)
            for (const cr of data.changeRequests) {
                const newCr = await tx.changeRequest.create({
                    data: {
                        type: cr.type,
                        status: cr.status,
                        data: cr.data,
                        itemId: cr.itemId ? idMapping.item.get(cr.itemId) : null,
                        targetProjectId: cr.targetProjectId ? idMapping.project.get(cr.targetProjectId) : null,
                        targetParentId: cr.targetParentId ? idMapping.item.get(cr.targetParentId) : null,
                        submitterName: cr.submitterName,
                        reviewerName: cr.reviewerName,
                        reviewNote: cr.reviewNote,
                        submitReason: cr.submitReason,
                    },
                });
                idMapping.changeRequest.set(cr.id, newCr.id);
            }

            // Step 8: ChangeRequest Phase 2 (UPDATE previousRequestId)
            for (const cr of data.changeRequests) {
                if (cr.previousRequestId) {
                    const newId = idMapping.changeRequest.get(cr.id);
                    const newPrevId = idMapping.changeRequest.get(cr.previousRequestId);
                    if (newId && newPrevId) {
                        await tx.changeRequest.update({
                            where: { id: newId },
                            data: { previousRequestId: newPrevId },
                        });
                    }
                }
            }

            // Step 9: ItemHistory
            for (const history of data.itemHistories) {
                const newHistory = await tx.itemHistory.create({
                    data: {
                        itemId: history.itemId ? idMapping.item.get(history.itemId) : null,
                        version: history.version,
                        changeType: history.changeType,
                        snapshot: history.snapshot,
                        diff: history.diff,
                        submitterName: history.submitterName,
                        reviewerName: history.reviewerName,
                        reviewStatus: history.reviewStatus,
                        reviewNote: history.reviewNote,
                        submitReason: history.submitReason,
                        itemFullId: regenerateFullId(history.itemFullId, oldCodePrefix, newCodePrefix),
                        itemTitle: history.itemTitle,
                        projectId: newProject.id,
                        isoDocPath: history.isoDocPath,
                    },
                });
                idMapping.itemHistory.set(history.id, newHistory.id);
            }

            // Step 10: QCDocumentApproval
            for (const approval of data.qcDocumentApprovals) {
                const newHistoryId = idMapping.itemHistory.get(approval.itemHistoryId);
                if (newHistoryId) {
                    const newApproval = await tx.qCDocumentApproval.create({
                        data: {
                            itemHistoryId: newHistoryId,
                            status: approval.status,
                            revisionCount: approval.revisionCount,
                            qcApproverName: approval.qcApproverName,
                            qcApprovedAt: approval.qcApprovedAt ? new Date(approval.qcApprovedAt) : null,
                            qcNote: approval.qcNote,
                            pmApproverName: approval.pmApproverName,
                            pmApprovedAt: approval.pmApprovedAt ? new Date(approval.pmApprovedAt) : null,
                            pmNote: approval.pmNote,
                        },
                    });
                    idMapping.qcApproval.set(approval.id, newApproval.id);
                }
            }

            // Step 11: QCDocumentRevision Phase 1 (不含 resolvedItemHistoryId)
            for (const revision of data.qcDocumentRevisions) {
                const newApprovalId = idMapping.qcApproval.get(revision.approvalId);
                if (newApprovalId) {
                    const newRevision = await tx.qCDocumentRevision.create({
                        data: {
                            approvalId: newApprovalId,
                            revisionNumber: revision.revisionNumber,
                            requestNote: revision.requestNote,
                            resolvedAt: revision.resolvedAt ? new Date(revision.resolvedAt) : null,
                        },
                    });
                    idMapping.qcRevision.set(revision.id, newRevision.id);
                }
            }

            // Step 12: QCDocumentRevision Phase 2 (UPDATE resolvedItemHistoryId)
            for (const revision of data.qcDocumentRevisions) {
                if (revision.resolvedItemHistoryId) {
                    const newId = idMapping.qcRevision.get(revision.id);
                    const newResolvedId = idMapping.itemHistory.get(revision.resolvedItemHistoryId);
                    if (newId && newResolvedId) {
                        await tx.qCDocumentRevision.update({
                            where: { id: newId },
                            data: { resolvedItemHistoryId: newResolvedId },
                        });
                    }
                }
            }

            // Step 13: DataFileChangeRequest (使用 fileId)
            for (const dfcr of data.dataFileChangeRequests) {
                const newFileId = dfcr.fileId ? idMapping.dataFile.get(dfcr.fileId) : null;
                await tx.dataFileChangeRequest.create({
                    data: {
                        fileId: newFileId,
                        type: dfcr.type,
                        status: dfcr.status,
                        data: dfcr.data,
                        submitterName: dfcr.submitterName,
                        reviewerName: dfcr.reviewerName,
                        reviewNote: dfcr.reviewNote,
                        submitReason: dfcr.submitReason,
                    },
                });
            }

            // Step 14: DataFileHistory
            for (const dfh of data.dataFileHistories) {
                const newFileId = dfh.fileId ? idMapping.dataFile.get(dfh.fileId) : undefined;
                await tx.dataFileHistory.create({
                    data: {
                        fileId: newFileId ?? null,
                        version: dfh.version,
                        changeType: dfh.changeType,
                        snapshot: dfh.snapshot,
                        diff: dfh.diff,
                        submitterName: dfh.submitterName,
                        reviewerName: dfh.reviewerName,
                        reviewStatus: dfh.reviewStatus,
                        reviewNote: dfh.reviewNote,
                        dataCode: dfh.dataCode,
                        dataName: dfh.dataName,
                        dataYear: dfh.dataYear,
                    },
                });
            }

            return {
                success: true,
                newProjectId: newProject.id,
                newCodePrefix,
                stats: {
                    itemsImported: data.items.length,
                    filesRestored,
                },
            };
        }, {
            maxWait: 30000,  // 等待取得連線的最大時間 (30s)
            timeout: 120000, // 交易執行的最大時間 (120s)
        });
        return { result, reusedDataCodes };
    } catch (error) {
        return {
            result: {
                success: false,
                error: error instanceof Error ? error.message : '匯入失敗',
                stats: { itemsImported: 0, filesRestored: 0 },
            },
            reusedDataCodes,
        };
    }
}

/**
 * Import only the database portion of a project archive. The public result
 * shape intentionally remains unchanged for existing callers and Server
 * Actions; file-reuse metadata is kept internal to the ZIP importer.
 */
export async function importProjectData(
    data: ImportData,
    options: ImportOptions
): Promise<ImportResult> {
    const { result } = await importProjectDataInternal(data, options);
    return result;
}

/**
 * 從 ZIP 檔案匯入專案
 */
export async function importProjectFromZip(
    zipBuffer: Buffer,
    options: ImportOptions
): Promise<ImportResult> {
    const basePath = process.cwd();
    let manifest: ImportManifest | null = null;
    let data: ImportData | null = null;
    const extractedFiles: Array<{ zipPath: string; targetPath: string }> = [];

    // 暫存解壓的檔案資料（先讀入記憶體，DB 成功後才寫入磁碟）
    const pendingFiles: PendingFile[] = [];

    try {
        // Step 1: 先讀取 manifest/data，再依 data.json 對應檔案。ZIP
        // entry 順序不可假設，且舊扁平 archive 的 basename 需要資料
        // 內容才能安全解析。
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries();

        for (const entry of entries) {
            if (entry.entryName === 'manifest.json') {
                const content = entry.getData().toString('utf-8');
                manifest = JSON.parse(content);
            } else if (entry.entryName === 'data.json') {
                const content = entry.getData().toString('utf-8');
                data = JSON.parse(content);
            }
        }

        if (!manifest || !data) {
            return {
                success: false,
                error: '無效的備份檔案：缺少 manifest.json 或 data.json',
                stats: { itemsImported: 0, filesRestored: 0 },
            };
        }

        // Stage all files only after the metadata is known. No filesystem
        // writes occur until the database transaction has committed.
        const stagedTargets = new Set<string>();
        for (const entry of entries) {
            if (!entry.entryName.startsWith('assets/') || entry.isDirectory) continue;

            let targetPath: string;
            let dataCodes: string[] | undefined;
            if (entry.entryName.startsWith(DATAFILE_ASSET_PREFIX)) {
                const dataFileAsset = await resolveDataFileAsset(entry.entryName, data, basePath);
                targetPath = dataFileAsset.targetPath;
                dataCodes = dataFileAsset.dataCodes;
            } else if (entry.entryName.startsWith('assets/uploads/')) {
                targetPath = path.join(basePath, 'public', 'uploads', path.basename(entry.entryName));
            } else if (entry.entryName.startsWith('assets/iso_doc/')) {
                targetPath = path.join(basePath, 'public', 'iso_doc', path.basename(entry.entryName));
            } else {
                continue;
            }

            // Zip Slip 防護：確認解析後的路徑在 public/ 目錄內。 DataFile
            // targets additionally go through resolveDataFilePathSafely above,
            // which checks symlink components before any later mkdir/write.
            const resolvedTarget = path.resolve(targetPath);
            const resolvedPublic = path.resolve(path.join(basePath, 'public'));
            if (resolvedTarget !== resolvedPublic && !resolvedTarget.startsWith(resolvedPublic + path.sep)) {
                throw new Error(`路徑穿越偵測: ${entry.entryName}`);
            }
            // DataFile assets have a one-to-one canonical target. Reject a
            // repeated entry rather than allowing archive order to decide
            // which bytes win. Keep the historical attachment/ISO basename
            // behavior unchanged.
            if (dataCodes && stagedTargets.has(resolvedTarget)) {
                throw new Error(`備份檔案包含重複的檔案路徑：${entry.entryName}`);
            }
            if (dataCodes) stagedTargets.add(resolvedTarget);

            pendingFiles.push({ targetPath, fileData: entry.getData(), dataCodes });
        }

        // 檢查版本相容性
        if (manifest.version !== SYSTEM_VERSION) {
            console.warn(`備份版本 ${manifest.version} 與系統版本 ${SYSTEM_VERSION} 不同，將嘗試匯入`);
        }

        // Step 2: 先執行資料庫匯入（交易內，失敗自動回滾）
        const { result, reusedDataCodes } = await importProjectDataInternal(data, options);

        if (!result.success) {
            // DB 匯入失敗，不寫入任何檔案
            return result;
        }

        // Step 3: DB 成功後才寫入檔案至磁碟
        for (const { targetPath, fileData, dataCodes } of pendingFiles) {
            // A dataCode collision reuses the existing DataFile record and its
            // physical asset. Never replace that asset with bytes from the
            // imported archive (the existing record may use a different path).
            // Only omit an archive asset when every DataFile record that
            // resolves to this physical path was reused.  A shared path can
            // contain a mix of reused and newly-created records: the new
            // record still needs the archive bytes, while the reused record's
            // original path/bytes must remain untouched.
            if (dataCodes?.every((dataCode) => reusedDataCodes.has(dataCode))) continue;

            // DataFile paths are generated from unique upload directories. If
            // a non-reused record nevertheless points to an existing target,
            // preserve that file too; overwriting it could destroy an
            // unrelated active DataFile or an orphan needed for recovery.
            if (dataCodes && existsSync(targetPath)) continue;

            mkdirSync(path.dirname(targetPath), { recursive: true });
            writeFileSync(targetPath, fileData);
            extractedFiles.push({ zipPath: '', targetPath });
        }

        // 更新統計
        result.stats.filesRestored = extractedFiles.length;

        return result;
    } catch (error) {
        // 清理已寫入的檔案（若部分檔案已寫入後發生錯誤）
        for (const { targetPath } of extractedFiles) {
            try {
                if (existsSync(targetPath)) {
                    unlinkSync(targetPath);
                }
            } catch {
                // 忽略清理錯誤
            }
        }

        return {
            success: false,
            error: `匯入失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
            stats: { itemsImported: 0, filesRestored: 0 },
        };
    }
}
