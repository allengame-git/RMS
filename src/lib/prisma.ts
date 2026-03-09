/**
 * @file prisma.ts
 * @description Prisma Client 單例模組
 *
 * 此模組提供全域的 Prisma Client 實例，確保：
 * - 開發環境：避免 Hot Reload 時建立過多連線
 * - 生產環境：使用單一連線池
 *
 * ## 使用方式
 * ```typescript
 * import { prisma } from '@/lib/prisma';
 *
 * const users = await prisma.user.findMany();
 * ```
 *
 * ## 日誌設定
 * 目前啟用 `query` 日誌，會輸出所有 SQL 查詢。
 * 生產環境建議移除以提升效能。
 *
 * @see /prisma/schema.prisma - 資料庫 Schema 定義
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "production" ? [] : ["query"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
