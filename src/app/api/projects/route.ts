/**
 * Projects List API
 * GET /api/projects - 獲取所有專案列表
 */

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const projects = await prisma.project.findMany({
            select: {
                id: true,
                title: true,
                codePrefix: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(projects);
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        return NextResponse.json(
            { error: '無法獲取專案列表' },
            { status: 500 }
        );
    }
}
