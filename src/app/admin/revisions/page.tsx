import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRevisionRequiredDocuments } from "@/actions/qc-approval";
import RevisionRequiredCard from "./RevisionRequiredCard";

export default async function RevisionsPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/auth/login");

    const documents = await getRevisionRequiredDocuments();

    return (
        <div className="container" style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <h1 style={{ marginBottom: "1.5rem" }}>待修改文件</h1>

            {documents.length === 0 ? (
                <div style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    backgroundColor: "var(--color-bg-surface)",
                    borderRadius: "12px",
                    border: "1px solid var(--color-border)"
                }}>
                    <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>✅</span>
                    <p style={{ color: "var(--color-text-muted)" }}>沒有需要修改的文件</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {documents.map((doc) => (
                        <RevisionRequiredCard key={doc.id} document={doc} />
                    ))}
                </div>
            )}
        </div>
    );
}
