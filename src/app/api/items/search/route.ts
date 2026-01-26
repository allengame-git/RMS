/**
 * @file route.ts (api/items/search)
 * @description 項目模糊搜尋 API
 *
 * 支援透過關鍵字同時搜尋項目編號與標題，用於關聯項目選擇器等自動完成介面。
 *
 * ## Query Params
 * - `q`: 搜尋關鍵字 (required)
 * - `exclude`: 要排除的項目 ID (optional)
 *
 * ## 搜尋邏輯
 * - 搜尋範圍: Items (不含已刪除)
 * - 比對欄位: fullId (contains) OR title (contains)
 * - 限制筆數: 20 筆
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const excludeIdStr = searchParams.get("exclude");
    const excludeId = excludeIdStr ? parseInt(excludeIdStr) : undefined;

    if (!query || query.trim().length === 0) {
        return NextResponse.json({ items: [] });
    }

    const searchTerm = query.trim();

    try {
        const items = await prisma.item.findMany({
            where: {
                isDeleted: false,
                AND: [
                    excludeId ? { id: { not: excludeId } } : {},
                    {
                        OR: [
                            { fullId: { contains: searchTerm, mode: 'insensitive' } },
                            { title: { contains: searchTerm, mode: 'insensitive' } }
                        ]
                    }
                ]
            },
            take: 20,
            orderBy: { fullId: 'asc' },
            select: {
                id: true,
                fullId: true,
                title: true,
                projectId: true,
                project: {
                    select: {
                        title: true
                    }
                }
            }
        });

        // Format for frontend
        const formattedItems = items.map(item => ({
            id: item.id,
            fullId: item.fullId,
            title: item.title,
            projectId: item.projectId,
            projectTitle: item.project.title
        }));

        return NextResponse.json({ items: formattedItems });

    } catch (error) {
        console.error("Error searching items:", error);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }
}
