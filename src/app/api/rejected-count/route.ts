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

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ count: 0 });
    }

    // 1. 統計項目變更退回
    const changeRequestCount = await prisma.changeRequest.count({
        where: {
            submittedById: session.user.id,
            status: "REJECTED"
        }
    });

    // 2. 統計檔案變更退回
    const dataFileRequestCount = await prisma.dataFileChangeRequest.count({
        where: {
            submittedById: session.user.id,
            status: "REJECTED"
        }
    });

    // 3. 統計品質文件修訂要求 (REVISION_REQUIRED)
    // 這些對編輯者來說也是「待修改」事項
    const qcRevisionCount = await prisma.qCDocumentApproval.count({
        where: {
            status: "REVISION_REQUIRED",
            itemHistory: {
                submittedById: session.user.id
            }
        }
    });

    return NextResponse.json({ count: changeRequestCount + dataFileRequestCount + qcRevisionCount });
}
