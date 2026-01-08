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
            <h1 style={{ marginBottom: "1.5rem" }}>通知中心</h1>
            <NotificationList initialNotifications={notifications} />
        </div>
    );
}
