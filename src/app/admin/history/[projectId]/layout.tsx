import { getProjectItems } from "@/actions/history";
import HistorySidebar from "@/components/history/HistorySidebar";

export const dynamic = 'force-dynamic';

export default async function ProjectHistoryLayout({ children, params }: { children: React.ReactNode, params: Promise<{ projectId: string }> }) {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr);
    const items = await getProjectItems(projectId);

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
            <aside style={{ flexShrink: 0 }}>
                <HistorySidebar items={items} projectId={projectId} />
            </aside>
            <main style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
                {children}
            </main>
        </div>
    )
}
