/**
 * @file backup-utils.ts
 * @description 資料庫備份與還原工具模組
 *
 * 此模組提供 RMS 系統的資料庫備份與還原功能。
 *
 * ## 核心功能
 * - `exportDatabaseToSQL`：將整個資料庫匯出為 SQL INSERT 語句
 * - `importDatabaseFromSQL`：執行 SQL 語句還原資料
 * - `generateDatabaseManifest`：生成備份清單（含統計資訊）
 * - `generateFileManifest`：生成檔案備份清單
 * - `forceLogoutAllUsers`：強制登出所有使用者
 *
 * ## 備份順序
 * 資料表依據外鍵關聯順序匯出/還原：
 * 1. User（基礎資料）
 * 2. ProjectCategory → Project → Item
 * 3. 關聯資料（ItemRelation, ItemReference）
 * 4. 審批資料（ChangeRequest, ItemHistory）
 * 5. QC 資料（QCDocumentApproval, QCDocumentRevision）
 * 6. DataFile 相關
 * 7. 日誌資料（Notification, LoginLog）
 *
 * ## 安全注意事項
 * - `importDatabaseFromSQL` 使用 `$executeRawUnsafe`
 * - 僅限管理員操作，且 SQL 應來自可信來源
 * - 還原前會停用外鍵檢查，還原後重新啟用
 *
 * ## 備份檔案格式
 * - `rms_db.sql`：SQL 語句檔案
 * - `manifest.json`：備份元資料
 *
 * @see /src/app/api/admin/backup - 備份 API 路由
 * @see /src/app/api/admin/restore - 還原 API 路由
 */

import { prisma } from '@/lib/prisma';

// 所有需要備份的資料表 (依據外鍵關聯順序)
const TABLES = [
    'User',
    'ProjectCategory',  // 必須在 Project 之前（Project 有外鍵依賴 ProjectCategory）
    'Project',
    'Item',
    'ItemRelation',
    'DataFile',          // 必須在 ItemReference 之前（ItemReference.fileId → DataFile.id）
    'ItemReference',
    'ChangeRequest',
    'ItemHistory',
    'QCDocumentApproval',
    'QCDocumentRevision',
    'DataFileChangeRequest',
    'DataFileHistory',
    'Notification',
    'LoginLog',
] as const;

type _TableName = (typeof TABLES)[number];

/**
 * 將值轉換為 SQL 字串格式
 */
export function escapeValue(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (value instanceof Date) {
        return `'${value.toISOString()}'`;
    }
    if (typeof value === 'string') {
        // 轉義單引號
        const escaped = value.replace(/'/g, "''");
        return `'${escaped}'`;
    }
    if (typeof value === 'object') {
        // JSON 物件/陣列
        const jsonStr = JSON.stringify(value).replace(/'/g, "''");
        return `'${jsonStr}'`;
    }
    return `'${String(value)}'`;
}

/**
 * 將 camelCase 轉換為 snake_case (PostgreSQL 預設)
 * 注意：Prisma 預設使用 camelCase 映射到資料庫欄位
 */
export function toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * 生成 INSERT 語句
 */
export function generateInsertStatements(tableName: string, records: Record<string, unknown>[]): string {
    if (records.length === 0) return '';

    // 將 tableName 轉為 snake_case (Prisma model 通常是 PascalCase)
    const dbTableName = `"${tableName}"`;

    let sql = `-- Table: ${tableName}\n`;
    sql += `-- Records: ${records.length}\n`;
    sql += `DELETE FROM ${dbTableName};\n`;

    for (const record of records) {
        const columns = Object.keys(record);
        const columnList = columns.map(c => `"${c}"`).join(', ');
        const valueList = columns.map(c => escapeValue(record[c])).join(', ');
        sql += `INSERT INTO ${dbTableName} (${columnList}) VALUES (${valueList});\n`;
    }

    sql += '\n';
    return sql;
}

/**
 * 匯出整個資料庫為 SQL 格式
 */
export async function exportDatabaseToSQL(): Promise<string> {
    let sql = '-- RMS Database Backup\n';
    sql += `-- Generated at: ${new Date().toISOString()}\n`;
    sql += '-- Database: PostgreSQL\n';
    sql += '-- Format: SQL INSERT statements\n\n';
    sql += 'BEGIN;\n\n';

    // 統計資訊
    const stats: Record<string, number> = {};

    // 依照相反順序清空資料 (使用 TRUNCATE CASCADE 確保強制清空)
    const reverseTables = [...TABLES].reverse();
    sql += '-- Disable foreign key checks temporarily\n';
    sql += 'SET session_replication_role = replica;\n\n';
    for (const table of reverseTables) {
        sql += `TRUNCATE TABLE "${table}" CASCADE;\n`;
    }
    sql += '\n-- Re-enable foreign key checks\n';
    sql += 'SET session_replication_role = DEFAULT;\n\n';

    // 依序匯出各資料表
    for (const table of TABLES) {
        try {
            // 使用動態存取 Prisma model
            // @ts-expect-error - 動態存取 Prisma model
            const records = await prisma[table.charAt(0).toLowerCase() + table.slice(1)].findMany();
            stats[table] = records.length;

            if (records.length > 0) {
                sql += generateInsertStatements(table, records as Record<string, unknown>[]);
            }
        } catch (error) {
            console.error(`Error exporting table ${table}:`, error);
            sql += `-- Error exporting ${table}: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
        }
    }

    sql += 'COMMIT;\n';
    sql += '\n-- Export completed\n';
    sql += `-- Statistics: ${JSON.stringify(stats)}\n`;

    return sql;
}

/**
 * 生成備份 manifest
 */
export async function generateDatabaseManifest(): Promise<object> {
    const stats: Record<string, number> = {};

    for (const table of TABLES) {
        try {
            // @ts-expect-error - 動態存取 Prisma model
            const count = await prisma[table.charAt(0).toLowerCase() + table.slice(1)].count();
            stats[table] = count;
        } catch {
            stats[table] = 0;
        }
    }

    return {
        version: '1.1',
        createdAt: new Date().toISOString(),
        systemVersion: '1.6.0',
        backupType: 'database',
        databaseType: 'postgresql',
        stats: {
            tableCount: TABLES.length,
            ...stats,
        },
    };
}

/**
 * 生成檔案備份 manifest
 */
export function generateFileManifest(
    backupType: 'uploads' | 'iso-docs',
    fileCount: number,
    totalSize: number
): object {
    return {
        version: '1.1',
        createdAt: new Date().toISOString(),
        systemVersion: '1.6.0',
        backupType,
        stats: {
            fileCount,
            totalSizeBytes: totalSize,
            totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        },
    };
}

/**
 * 執行 SQL 匯入 (復原用)
 */
export async function importDatabaseFromSQL(sql: string): Promise<{ success: boolean; error?: string }> {
    try {
        // 使用 Prisma 的 $executeRawUnsafe 執行 SQL
        // 注意：這是危險操作，僅限可信來源的 SQL
        await prisma.$executeRawUnsafe(sql);
        return { success: true };
    } catch (error) {
        console.error('Database import error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * 強制登出所有使用者
 * 透過更新所有使用者的 updatedAt 時間戳，使現有 JWT token 失效
 */
export async function forceLogoutAllUsers(): Promise<void> {
    await prisma.user.updateMany({
        data: {
            updatedAt: new Date(),
        },
    });
}
