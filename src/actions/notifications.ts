"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
export async function createNotification(input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
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
