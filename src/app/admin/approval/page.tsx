import { getPendingRequests, approveRequest, rejectRequest } from "@/actions/approval";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ApprovalList from "@/components/approval/ApprovalList";

export const dynamic = 'force-dynamic';

export default async function ApprovalPage() {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "INSPECTOR")) {
        redirect("/");
    }

    const requests = await getPendingRequests();

    return (
        <div className="container" style={{ paddingBottom: "4rem" }}>
            <h1 style={{ marginBottom: "2rem" }}>Approval Dashboard</h1>
            <ApprovalList requests={requests} />
        </div>
    );
}
