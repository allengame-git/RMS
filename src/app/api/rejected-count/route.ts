/**
 * @file route.ts (api/rejected-count)
 * @description 被拒絕申請計數 API 路由
 *
 * 專門用於通知當前登入使用者，其提交的申請中有多少筆被「退回 (REJECTED)」。
 *
 * ## 統計邏輯
 * - 僅對當前 `session.user.id` 提交且狀態為 `REJECTED` 的 `ChangeRequest` 進行計算。
 *
 * @see /src/components/layout/Navbar.tsx - 用於顯示個人通知提醒
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ count: 0 });
    }

    const count = await prisma.changeRequest.count({
        where: {
            submittedById: session.user.id,
            status: "REJECTED"
        }
    });

    return NextResponse.json({ count });
}
