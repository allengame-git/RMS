import { getPendingRequests } from "@/actions/approval";
import { getPendingDataFileRequests } from "@/actions/data-files";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ApprovalList from "@/components/approval/ApprovalList";
import DataFileApprovalList from "@/components/datafile/DataFileApprovalList";

export const dynamic = 'force-dynamic';

export default async function ApprovalPage() {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "INSPECTOR")) {
        redirect("/");
    }

    const requests = await getPendingRequests();
    const fileRequests = await getPendingDataFileRequests();

    return (
        <div className="container" style={{ paddingBottom: "4rem" }}>
            <h1 style={{ marginBottom: "2rem" }}>Approval Dashboard</h1>

            {/* Item Change Requests */}
            {requests.length > 0 && (
                <div style={{ marginBottom: "3rem" }}>
                    <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "var(--color-text-secondary)" }}>
                        📋 項目變更申請 ({requests.length})
                    </h2>
                    <ApprovalList requests={requests} currentUsername={session.user.username} />
                </div>
            )}

            {/* DataFile Change Requests */}
            {fileRequests.length > 0 && (
                <div style={{ marginBottom: "3rem" }}>
                    <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "var(--color-text-secondary)" }}>
                        📁 檔案變更申請 ({fileRequests.length})
                    </h2>
                    <DataFileApprovalList requests={fileRequests} currentUsername={session.user.username} currentUserRole={session.user.role} />
                </div>
            )}

            {requests.length === 0 && fileRequests.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    color: 'var(--color-text-muted)'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                    <p>目前沒有待審核的申請</p>
                </div>
            )}
        </div>
    );
}
