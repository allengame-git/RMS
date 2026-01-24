/**
 * @file route.ts (api/pending-count)
 * @description 待辦事項計數 API 路由
 *
 * 供導航列 (Navbar) 呼叫，用以顯示當前使用者需要處理的審核申請數量。
 * 數量統計採權限隔離，使用者只會看到其職責範圍內的待辦。
 *
 * ## 統計邏輯
 * 1. **ADMIN/INSPECTOR**: 統計 PENDING 狀態的 `ChangeRequest` 與 `DataFileChangeRequest`。
 * 2. **QC 資格者**: 統計 PENDING_QC 狀態的 `QCDocumentApproval`。
 * 3. **PM 資格者**: 統計 PENDING_PM 狀態的 `QCDocumentApproval`。
 *
 * ## 回傳格式
 * - `count`: 總待辦數量
 * - `hasApprovalAccess`: 是否具有進入審批頁面的權限
 *
 * @see /src/components/layout/Navbar.tsx - 呼叫此 API 顯示紅點徽章
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ count: 0 });
    }

    const role = session.user.role;

    try {
        // Fetch user to check isQC and isPM flags
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isQC: true, isPM: true }
        });

        let totalCount = 0;

        // ADMIN and INSPECTOR see pending ChangeRequests and DataFileChangeRequests
        if (role === "ADMIN" || role === "INSPECTOR") {
            const changeRequestCount = await prisma.changeRequest.count({
                where: { status: "PENDING" }
            });
            const dataFileRequestCount = await prisma.dataFileChangeRequest.count({
                where: { status: "PENDING" }
            });
            totalCount += changeRequestCount + dataFileRequestCount;
        }

        // Users with QC permission see PENDING_QC documents
        if (user?.isQC || role === "ADMIN") {
            const qcPendingCount = await prisma.qCDocumentApproval.count({
                where: { status: "PENDING_QC" }
            });
            totalCount += qcPendingCount;
        }

        // Users with PM permission see PENDING_PM documents
        if (user?.isPM || role === "ADMIN") {
            const pmPendingCount = await prisma.qCDocumentApproval.count({
                where: { status: "PENDING_PM" }
            });
            totalCount += pmPendingCount;
        }

        // Determine if user has approval access (isQC or isPM or ADMIN/INSPECTOR)
        const hasApprovalAccess = user?.isQC || user?.isPM ||
            role === "ADMIN" || role === "INSPECTOR";

        return NextResponse.json({ count: totalCount, hasApprovalAccess });
    } catch (error) {
        console.error("Error fetching pending count:", error);
        return NextResponse.json({ count: 0, hasApprovalAccess: false });
    }
}

