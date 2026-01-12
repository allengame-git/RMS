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

