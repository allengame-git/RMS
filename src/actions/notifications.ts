/**
 * @file notifications.ts
 * @description 系統通知模組
 *
 * 此模組負責 RMS 系統的通知功能，用於通知使用者重要事件。
 *
 * ## 核心功能
 * - `createNotification`：建立通知（支援事務處理）
 * - `getNotifications`：取得使用者的通知列表
 * - `markAsRead`：標記通知為已讀
 * - `markAllAsRead`：標記所有通知為已讀
 * - `getUnreadCount`：取得未讀通知數量
 *
 * ## 通知類型 (NotificationType)
 * - `REJECTION`：變更申請被拒絕
 * - `REVISION_REQUEST`：QC/PM 要求修訂
 * - `APPROVAL`：變更申請已核准
 * - `COMPLETED`：品質文件審核完成
 *
 * ## 通知觸發時機
 * - 審批流程中（approval.ts）
 * - QC 審查流程中（qc-approval.ts）
 *
 * ## 通知連結
 * 每個通知可附帶 `link` 欄位，點擊後導向相關頁面
 *
 * @see /src/app/notifications - 通知列表頁面
 * @see /src/components/layout/Navbar.tsx - 通知 Badge 顯示
 */

"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// ============================================
// Notification Types
// ============================================

export type NotificationType =
    | "REJECTION"        // 變更申請被拒絕
    | "REVISION_REQUEST" // QC/PM 要求修改
    | "APPROVAL"         // 變更申請已核准
    | "COMPLETED";       // 品質文件審核完成

export interface CreateNotificationInput {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    changeRequestId?: number;
    qcApprovalId?: number;
    itemHistoryId?: number;
}

// ============================================
// Server Actions
// ============================================

/**
 * 建立通知
 */
export async function createNotification(input: CreateNotificationInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const notification = await client.notification.create({
        data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            message: input.message,
            link: input.link,
            changeRequestId: input.changeRequestId,
            qcApprovalId: input.qcApprovalId,
            itemHistoryId: input.itemHistoryId,
        },
    });

    return notification;
}

/**
 * 取得當前使用者的通知列表
 */
export async function getNotifications(limit: number = 20) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return [];

    const notifications = await prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
    });

    return notifications;
}

/**
 * 取得未讀通知數量
 */
export async function getUnreadCount(): Promise<number> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return 0;

    const count = await prisma.notification.count({
        where: {
            userId: session.user.id,
            isRead: false,
        },
    });

    return count;
}

/**
 * 標記單一通知為已讀
 */
export async function markAsRead(notificationId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    await prisma.notification.updateMany({
        where: {
            id: notificationId,
            userId: session.user.id, // 確保只能標記自己的通知
        },
        data: { isRead: true },
    });

    revalidatePath("/notifications");
}

/**
 * 標記所有通知為已讀
 */
export async function markAllAsRead() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    await prisma.notification.updateMany({
        where: {
            userId: session.user.id,
            isRead: false,
        },
        data: { isRead: true },
    });

    revalidatePath("/notifications");
}

/**
 * 刪除通知
 */
export async function deleteNotification(notificationId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    await prisma.notification.deleteMany({
        where: {
            id: notificationId,
            userId: session.user.id, // 確保只能刪除自己的通知
        },
    });

    revalidatePath("/notifications");
}

/**
 * 清除所有已讀通知 (保留 30 天內)
 */
export async function clearReadNotifications() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await prisma.notification.deleteMany({
        where: {
            userId: session.user.id,
            isRead: true,
            createdAt: { lt: thirtyDaysAgo },
        },
    });

    revalidatePath("/notifications");
}

/**
 * 刪除所有已讀通知
 */
export async function deleteAllReadNotifications() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    await prisma.notification.deleteMany({
        where: {
            userId: session.user.id,
            isRead: true,
        },
    });

    revalidatePath("/notifications");
}
