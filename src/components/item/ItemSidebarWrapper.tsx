'use client';

import { usePathname } from 'next/navigation';
import { ItemNode } from '@/lib/tree-utils';
import SidebarNav from './SidebarNav';

interface ItemSidebarWrapperProps {
    nodes: ItemNode[];
    canEdit: boolean;
    projectId: number;
}

export default function ItemSidebarWrapper({ nodes, canEdit, projectId }: ItemSidebarWrapperProps) {
    const pathname = usePathname();

    // Extract current item ID from URL: /items/30 -> 30
    const match = pathname.match(/\/items\/(\d+)/);
    const currentItemId = match ? parseInt(match[1]) : undefined;

    return (
        <SidebarNav
            nodes={nodes}
            currentItemId={currentItemId}
            canEdit={canEdit}
            projectId={projectId}
        />
    );
}
