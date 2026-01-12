import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/datafiles/search
 * Search data files by code, name, filename, or author
 * Query params:
 *   - q: search query (required)
 *   - limit: max results (optional, default 20)
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
