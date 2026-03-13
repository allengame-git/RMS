'use client';

import { useState } from 'react';
import ReorderDialog from './ReorderDialog';
import RenumberDialog from './RenumberDialog';
import type { ItemNode } from '@/lib/tree-utils';

interface RootManageMenuProps {
    projectId: number;
    rootNodes: ItemNode[];
}

type DialogType = 'reorder' | 'renumber' | null;

export default function RootManageMenu({ projectId, rootNodes }: RootManageMenuProps) {
    const [activeDialog, setActiveDialog] = useState<DialogType>(null);

    if (rootNodes.length === 0) return null;

    return (
        <>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    type="button"
                    onClick={() => setActiveDialog('reorder')}
                    className="btn btn-outline"
                    style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.85rem',
                    }}
                >
                    根項目排序
                </button>
                <button
                    type="button"
                    onClick={() => setActiveDialog('renumber')}
                    className="btn btn-outline"
                    style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.85rem',
                    }}
                >
                    根項目重新編號
                </button>
            </div>

            {activeDialog === 'reorder' && (
                <ReorderDialog
                    items={rootNodes.map(n => ({ id: n.id, fullId: n.fullId, title: n.title }))}
                    parentId={null}
                    projectId={projectId}
                    onClose={() => setActiveDialog(null)}
                />
            )}
            {activeDialog === 'renumber' && (
                <RenumberDialog
                    parentId={null}
                    parentFullId={null}
                    projectId={projectId}
                    onClose={() => setActiveDialog(null)}
                />
            )}
        </>
    );
}
