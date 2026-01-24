/**
 * @file page.tsx (app/notifications)
 * @description 個人通知中心頁面
 *
 * 供使用者查看其相關的所有通知紀錄（按時間倒序）。
 *
 * ## 呈現內容
 * - **通知清單**：串接 `NotificationList` 元件顯示詳細通知內容。
 * - **效能優化**：預設僅讀取最近 100 筆通知。
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NotificationList from "./NotificationList";

export default async function NotificationsPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/auth/login");

    const notifications = await prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
    });

    return (
        <div className="container" style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: "var(--color-primary-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                </div>
                <h1 style={{ margin: 0 }}>通知中心</h1>
            </div>
            <NotificationList initialNotifications={notifications} />
        </div>
    );
}
