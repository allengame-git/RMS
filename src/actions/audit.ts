"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Log a login attempt (success or failure)
 */
export async function logLoginAttempt(data: {
    username: string;
    success: boolean;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    failReason?: string;
}) {
    try {
        await prisma.loginLog.create({
            data: {
                username: data.username,
                success: data.success,
                userId: data.userId || null,
                ipAddress: data.ipAddress || null,
                userAgent: data.userAgent || null,
                failReason: data.failReason || null,
            },
        });
    } catch (error) {
        console.error("[logLoginAttempt] Failed to log:", error);
        // Don't throw - logging should not break login flow
    }
}

/**
 * Get login logs with optional filters (Admin only)
 */
export async function getLoginLogs(filters?: {
    userId?: string;
    username?: string;
    success?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
}) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized: Admin access required");
    }

    const where: Prisma.LoginLogWhereInput = {};

    if (filters?.userId) {
        where.userId = filters.userId;
    }
    if (filters?.username) {
        where.username = { contains: filters.username, mode: 'insensitive' };
    }
    if (filters?.success !== undefined) {
        where.success = filters.success;
    }
    if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const logs = await prisma.loginLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 100,
        skip: filters?.offset || 0,
        include: {
            user: {
                select: { username: true, role: true }
            }
        }
    });

    const total = await prisma.loginLog.count({ where });

    return { logs, total };
}

/**
 * Get login statistics for dashboard
 */
export async function getLoginStats(days: number = 7) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized: Admin access required");
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalLogins, successfulLogins, failedLogins, uniqueUsers] = await Promise.all([
        prisma.loginLog.count({
            where: { createdAt: { gte: since } }
        }),
        prisma.loginLog.count({
            where: { createdAt: { gte: since }, success: true }
        }),
        prisma.loginLog.count({
            where: { createdAt: { gte: since }, success: false }
        }),
        prisma.loginLog.groupBy({
            by: ['username'],
            where: { createdAt: { gte: since }, success: true },
            _count: true
        }).then(r => r.length)
    ]);

    return {
        totalLogins,
        successfulLogins,
        failedLogins,
        uniqueUsers,
        successRate: totalLogins > 0 ? Math.round((successfulLogins / totalLogins) * 100) : 0
    };
}

/**
 * Get recent failed login attempts for a specific user
 */
export async function getRecentFailedAttempts(username: string, minutes: number = 15) {
    const since = new Date();
    since.setMinutes(since.getMinutes() - minutes);

    return await prisma.loginLog.count({
        where: {
            username,
            success: false,
            createdAt: { gte: since }
        }
    });
}

/**
 * Export daily login logs to a JSON file
 * @param date - The date to export logs for (defaults to yesterday)
 * @returns Path to the exported file
 */
export async function exportDailyLoginLogs(date?: Date): Promise<{ success: boolean; filePath?: string; recordCount?: number; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized: Admin access required" };
    }

    try {
        // Default to yesterday if no date provided
        const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

        // Calculate date range (start of day to end of day)
        const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
        const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

        // Fetch logs for the specified date
        const logs = await prisma.loginLog.findMany({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            orderBy: { createdAt: 'asc' },
            include: {
                user: {
                    select: { username: true, role: true }
                }
            }
        });

        // Prepare export data
        const exportData = {
            exportDate: dateStr,
            generatedAt: new Date().toISOString(),
            totalRecords: logs.length,
            logs: logs.map(log => ({
                id: log.id,
                username: log.username,
                success: log.success,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                failReason: log.failReason,
                createdAt: log.createdAt.toISOString(),
                user: log.user ? { username: log.user.username, role: log.user.role } : null
            }))
        };

        // Ensure daily_logs directory exists
        const logsDir = path.join(process.cwd(), 'daily_logs');
        await fs.mkdir(logsDir, { recursive: true });

        // Write to file
        const fileName = `login_log_${dateStr}.json`;
        const filePath = path.join(logsDir, fileName);
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');

        console.log(`[exportDailyLoginLogs] Exported ${logs.length} records to ${filePath}`);

        return {
            success: true,
            filePath: fileName,
            recordCount: logs.length
        };
    } catch (error) {
        console.error("[exportDailyLoginLogs] Export failed:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
