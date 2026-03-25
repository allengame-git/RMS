/**
 * @file rejected-requests.ts
 * @description 被拒絕申請處理模組
 *
 * 此模組負責處理被拒絕的變更申請的後續操作。
 *
 * ## 核心功能
 * - `markRejectedAsResubmitted`：標記被拒絕的申請為「已重新提交」
 *
 * ## 狀態流轉
 * PENDING → REJECTED → RESUBMITTED
 *
 * ## 使用場景
 * 當使用者修改被拒絕的申請並重新提交後，
 * 系統會建立新的 ChangeRequest，同時將舊的標記為 RESUBMITTED。
 *
 * ## 通知同步
 * 標記時會同時將相關通知標為已讀，避免重複提醒。
 *
 * @see /src/app/notifications - 通知頁面（可重新提交被拒絕的申請）
 * @see /src/actions/approval.ts - 審批流程
 */

"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Mark a rejected request as resubmitted (changes status from REJECTED to RESUBMITTED)
 * This is called after creating a new change request based on the rejected one
 */
export async function markRejectedAsResubmitted(requestId: number): Promise<{ success?: boolean; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session) return { error: "Unauthorized" };

    const request = await prisma.changeRequest.findUnique({
        where: { id: requestId }
    });

    if (!request) return { error: "Request not found" };

    // Verify ownership
    if (request.submittedById !== session.user.id && session.user.role !== "ADMIN") {
        return { error: "Unauthorized" };
    }

    // Update status to indicate it was resubmitted
    // We'll use "RESUBMITTED" to hide it from the "Pending Revisions" list
    // but keep it in the database for history tracking
    await prisma.changeRequest.update({
        where: { id: requestId },
        data: { status: "RESUBMITTED" }
    });

    // Mark related notifications as read
    try {
        await prisma.notification.updateMany({
            where: {
                userId: session.user.id,
                changeRequestId: requestId,
                isRead: false
            },
            data: { isRead: true }
        });
        revalidatePath("/notifications");
    } catch (e) {
        console.error("Failed to sync notifications:", e);
    }

    return { success: true };
}
