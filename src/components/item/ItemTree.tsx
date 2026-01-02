'use client';

import { ItemNode } from '@/lib/tree-utils';
import Link from 'next/link';
import { useState } from 'react';
import CreateItemForm from './CreateItemForm';

interface ItemTreeProps {
    nodes: ItemNode[];
    level?: number;
    canEdit?: boolean;
    projectId?: number;
}

export default function ItemTree({ nodes, level = 0, canEdit = false, projectId }: ItemTreeProps) {
    if (!nodes || nodes.length === 0) return null;

    return (
        <div style={{ paddingLeft: level > 0 ? '1.5rem' : '0', borderLeft: level > 0 ? '1px solid var(--color-border)' : 'none' }}>
            {nodes.map(node => (
                <div key={node.id} style={{ marginBottom: '0.5rem', position: 'relative' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s',
                        // hover effect via className or style? Inline hover is hard. 
                        // Let's assume global css or simple style.
                    }}
                        className="item-tree-node" // We can add this class to global css if needed
                    >
                        {/* Indent guide already handled by paddingLeft on container */}

                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Link
                                href={`/items/${node.id}`}
                                style={{
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'baseline'
                                }}
                            >
                                <span style={{
                                    fontFamily: 'var(--font-geist-mono)',
                                    fontWeight: 'bold',
                                    color: 'var(--color-primary)',
                                    fontSize: '0.9rem'
                                }}>
                                    {node.fullId}
                                </span>
                                <span style={{ fontWeight: 500 }}>{node.title}</span>
                            </Link>

                            {/* Add Child Button */}
                            {canEdit && projectId && (
                                <CreateItemForm
                                    projectId={projectId}
                                    parentId={node.id}
                                    modal={true}
                                    trigger={
                                        <button
                                            title="Add Child Item"
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '50%',
                                                border: '1px solid var(--color-border)',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                color: 'var(--color-text-muted)',
                                                fontSize: '12px',
                                                lineHeight: 1
                                            }}
                                            className="add-child-btn"
                                        >
                                            +
                                        </button>
                                    }
                                />
                            )}
                        </div>
                    </div>

                    {/* Recursion */}
                    {node.children && node.children.length > 0 && (
                        <ItemTree nodes={node.children} level={level + 1} canEdit={canEdit} projectId={projectId} />
                    )}
                </div>
            ))}
            <style jsx>{`
                .item-tree-node:hover {
                    background-color: rgba(0,0,0,0.03);
                }
                .add-child-btn:hover {
                    background-color: var(--color-primary);
                    color: white !important;
                    border-color: var(--color-primary) !important;
                }
            `}</style>
        </div>
    );
}
