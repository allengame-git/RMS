/**
 * @file route.ts (api/health)
 * @description 系統健康檢查 API 路由
 *
 * 提供自動化監控工具檢測系統可用性。
 *
 * ## 測試項目
 * 1. API 運行狀態
 * 2. Prisma/PostgreSQL 資料庫連線檢測 (SELECT 1)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // 測試資料庫連線
        await prisma.$queryRaw`SELECT 1`;

        return NextResponse.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            version: process.env.npm_package_version || '0.1.0'
        });
    } catch (error) {
        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
