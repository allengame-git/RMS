import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const fullId = searchParams.get("fullId");

    if (!fullId) {
        return NextResponse.json({ error: "fullId is required" }, { status: 400 });
    }

    try {
        const item = await prisma.item.findFirst({
            where: {
                fullId: fullId,
                isDeleted: false,
            },
            select: {
                id: true,
                fullId: true,
                title: true,
                projectId: true,
                project: {
                    select: {
                        title: true,
                    },
                },
            },
        });

        if (!item) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        return NextResponse.json({
            id: item.id,
            fullId: item.fullId,
            title: item.title,
            projectId: item.projectId,
            projectTitle: item.project.title,
        });
    } catch (error) {
        console.error("Error looking up item:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
