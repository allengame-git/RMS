/**
 * @file route.ts (api/items/lookup)
 * @description 項目資訊反查 API 路由
 *
 * 根據項目的完整編號 (fullId) 查詢其基本資訊。主要用於富文本編輯器中的「項目連結」功能。
 *
 * ## 核心功能
 * - 輸入: `fullId` (例如: RMS-1-2)
 * - 回傳: 項目 ID、標題、專案 ID 與專案標題
 * - 僅查詢未被刪除的項目
 *
 * @see /src/components/editor/plugins/itemLinkValidationPlugin.ts - 編輯器輸入時自動呼叫進行有效性檢查
 */

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
