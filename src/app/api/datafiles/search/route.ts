import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * @file route.ts (api/datafiles/search)
 * @description 資料檔案搜尋 API 路由
 *
 * 提供對已上架資料檔案的全文檢索功能。
 *
 * ## 核心功能
 * - 搜尋範圍：資料編碼、名稱、原始檔名、作者、以及年份
 * - 支援不分大小寫的模糊搜尋 (Case-insensitive)
 * - 分頁限制 (預設取前 20 筆)
 * - 回傳基本元資料與下載路徑
 *
 * ## 使用場景
 * - 在編輯器新增「參考文獻」時的即時搜尋
 *
 * @see /src/components/item/ReferencesManager.tsx - 呼叫此 API
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!query || query.trim().length < 1) {
        return NextResponse.json(
            { error: "Search query is required" },
            { status: 400 }
        );
    }

    try {
        const files = await prisma.dataFile.findMany({
            where: {
                isDeleted: false,
                OR: [
                    { dataCode: { contains: query, mode: "insensitive" } },
                    { dataName: { contains: query, mode: "insensitive" } },
                    { fileName: { contains: query, mode: "insensitive" } },
                    { author: { contains: query, mode: "insensitive" } },
                    // Check if query is a valid number for year search
                    ...(!isNaN(parseInt(query)) ? [{ dataYear: parseInt(query) }] : []),
                ],
            },
            select: {
                id: true,
                dataCode: true,
                dataName: true,
                dataYear: true,
                author: true,
                fileName: true,
                filePath: true,
            },
            orderBy: [
                { dataYear: "desc" },
                { dataName: "asc" },
            ],
            take: limit,
        });

        return NextResponse.json({ files });
    } catch (error) {
        console.error("[API/datafiles/search] Error:", error);
        return NextResponse.json(
            { error: "Search failed" },
            { status: 500 }
        );
    }
}
