/**
 * @file page.tsx (app/admin/approval)
 * @description 系統審核中心管理頁面
 *
 * 管理員與審核員 (INSPECTOR/QC/PM) 的核心工作區，集中處理各類變更申請與品質文件簽核。
 *
 * ## 審核類別
 * 1. **項目變更申請**：項目的新增、修改、與刪除。
 * 2. **檔案變更申請**：資料檔案模組的參考文獻管理。
 * 3. **品質文件簽核 (QC/PM)**：PDF 品質文件的多階段簽署。
 *
 * ## 權限控制
 * - ADMIN / INSPECTOR：可審核所有申請。
 * - EDITOR：僅可檢視與撤回自己提交的申請。
 * - 內部元件進一步細分 QC 與 PM 資格者的操作範圍。
 */

import { getPendingRequests } from "@/actions/approval";
import { getPendingDataFileRequests } from "@/actions/data-files";
import { getQCDocumentApprovals } from "@/actions/qc-approval";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ApprovalList from "@/components/approval/ApprovalList";
import DataFileApprovalList from "@/components/datafile/DataFileApprovalList";
import QCDocumentApprovalSection from "./QCDocumentApprovalSection";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function ApprovalPage() {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "INSPECTOR" && session.user.role !== "EDITOR")) {
        redirect("/");
    }

    // Fetch user qualifications
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isQC: true, isPM: true }
    });

    const requests = await getPendingRequests();
    const fileRequests = await getPendingDataFileRequests();

    // Fetch QC document approvals if user has QC or PM qualifications
    let qcApprovals: any[] = [];
    if (user?.isQC || user?.isPM) {
        try {
            qcApprovals = await getQCDocumentApprovals();
        } catch (e) {
            console.error("Failed to fetch QC approvals:", e);
        }
    }

    const hasNoRequests = requests.length === 0 && fileRequests.length === 0 && qcApprovals.length === 0;

    return (
        <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
            {/* Header */}
            <div style={{
                marginBottom: "2rem",
                paddingBottom: "1.5rem",
                borderBottom: "1px solid var(--color-border)"
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "0.5rem"
                }}>
                    <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "8px",
                        backgroundColor: "var(--color-primary-soft)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                            <path d="M9 11l3 3L22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                    </div>
                    <h1 style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "var(--color-text-main)",
                        margin: 0
                    }}>
                        審核中心
                    </h1>
                </div>
                <p style={{
                    color: "var(--color-text-muted)",
                    margin: 0,
                    fontSize: "0.9rem",
                    paddingLeft: "52px"
                }}>
                    審核待處理的變更申請與品質文件
                </p>
            </div>

            {/* Item Change Requests */}
            {requests.length > 0 && (
                <div style={{ marginBottom: "2.5rem" }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        marginBottom: "1rem"
                    }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "6px",
                            backgroundColor: "rgba(139, 92, 246, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                        </div>
                        <h2 style={{
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            color: "var(--color-text-main)",
                            margin: 0
                        }}>
                            項目變更申請
                        </h2>
                        <span style={{
                            padding: "0.2rem 0.6rem",
                            backgroundColor: "rgba(139, 92, 246, 0.1)",
                            color: "#8b5cf6",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600
                        }}>
                            {requests.length}
                        </span>
                    </div>
                    <ApprovalList requests={requests} currentUsername={session.user.username} currentUserRole={session.user.role} />
                </div>
            )}

            {/* DataFile Change Requests */}
            {fileRequests.length > 0 && (
                <div style={{ marginBottom: "2.5rem" }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        marginBottom: "1rem"
                    }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "6px",
                            backgroundColor: "rgba(14, 165, 233, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                        </div>
                        <h2 style={{
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            color: "var(--color-text-main)",
                            margin: 0
                        }}>
                            檔案變更申請
                        </h2>
                        <span style={{
                            padding: "0.2rem 0.6rem",
                            backgroundColor: "rgba(14, 165, 233, 0.1)",
                            color: "#0ea5e9",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600
                        }}>
                            {fileRequests.length}
                        </span>
                    </div>
                    <DataFileApprovalList requests={fileRequests} currentUsername={session.user.username} currentUserRole={session.user.role} />
                </div>
            )}

            {/* QC Document Approvals - Only visible to QC/PM users */}
            {(user?.isQC || user?.isPM) && (
                <QCDocumentApprovalSection
                    initialApprovals={qcApprovals}
                    userQualifications={{
                        isQC: user?.isQC || false,
                        isPM: user?.isPM || false
                    }}
                />
            )}

            {hasNoRequests && (
                <div className="glass" style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    color: 'var(--color-text-muted)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--color-border)'
                }}>
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ marginBottom: '1rem', opacity: 0.4 }}
                    >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>目前沒有待審核的申請</p>
                </div>
            )}
        </div>
    );
}
