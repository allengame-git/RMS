"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type HistoryItem = {
    fullId: string;
    title: string;
    isDeleted: boolean;
    historyCount: number;
};

type TreeNode = HistoryItem & {
    children: TreeNode[];
    level: number;
};

/**
 * Build a tree structure from flat items based on fullId hierarchy
 * e.g., WQ-1 -> WQ-1-1 -> WQ-1-1-1
 */
function buildHistoryTree(items: HistoryItem[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // Sort by fullId length to process parents first
    const sorted = [...items].sort((a, b) => a.fullId.length - b.fullId.length);

    for (const item of sorted) {
        const parts = item.fullId.split('-');
        const level = parts.length - 1; // WQ-1 = level 1, WQ-1-1 = level 2

        const node: TreeNode = { ...item, children: [], level };
        nodeMap.set(item.fullId, node);

        if (parts.length <= 2) {
            // Root level (e.g., WQ-1)
            roots.push(node);
        } else {
            // Find parent by removing last segment
            const parentId = parts.slice(0, -1).join('-');
            const parent = nodeMap.get(parentId);
            if (parent) {
                parent.children.push(node);
            } else {
                // Parent not found, treat as root
                roots.push(node);
            }
        }
    }

    return roots;
}

export default function HistorySidebar({ items, projectId }: { items: HistoryItem[], projectId: number }) {
    const [search, setSearch] = useState('');
    const pathname = usePathname();

    const filtered = items.filter(i =>
        i.fullId.toLowerCase().includes(search.toLowerCase()) ||
        i.title.toLowerCase().includes(search.toLowerCase())
    );

    const tree = useMemo(() => buildHistoryTree(filtered), [filtered]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg-base)', borderRight: '1px solid var(--color-border)', width: '320px' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-surface)' }}>
                <Link href="/admin/history" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem', display: 'block', textDecoration: 'none' }}>
                    &larr; 返回專案列表
                </Link>
                <div style={{ marginBottom: '0.5rem' }}>
                    <input
                        type="text"
                        placeholder="搜尋項目..."
                        style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', background: 'var(--color-bg-base)' }}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    找到 {filtered.length} 個項目
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                {tree.map(node => (
                    <AccordionNode key={node.fullId} node={node} projectId={projectId} pathname={pathname} />
                ))}
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>找不到項目</div>
                )}
            </div>
        </div>
    )
}

interface AccordionNodeProps {
    node: TreeNode;
    projectId: number;
    pathname: string;
}

function AccordionNode({ node, projectId, pathname }: AccordionNodeProps) {
    const hasChildren = node.children.length > 0;
    const isActive = pathname.includes(`/item/${node.fullId}`);
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div style={{ marginBottom: '4px' }}>
            {/* Accordion Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    borderRadius: 'var(--radius-sm)',
                    background: isActive ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                    border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 2px 8px rgba(0,131,143,0.15)' : 'none',
                }}
            >
                {/* Expand/Collapse Toggle */}
                {hasChildren ? (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            width: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.02)',
                            border: 'none',
                            borderRight: '1px solid var(--color-border)',
                            cursor: 'pointer',
                            color: 'var(--color-text-muted)',
                            fontSize: '0.7rem',
                            transition: 'all 0.2s ease',
                        }}
                        title={isExpanded ? '折疊' : '展開'}
                    >
                        <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            ▶
                        </span>
                    </button>
                ) : (
                    <div style={{ width: '32px', background: 'rgba(0,0,0,0.02)', borderRight: '1px solid var(--color-border)' }} />
                )}

                {/* Link Content */}
                <Link
                    href={`/admin/history/${projectId}/item/${node.fullId}`}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        padding: '0.6rem 0.75rem',
                        textDecoration: 'none',
                        color: 'inherit',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                            fontFamily: 'var(--font-geist-mono)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: node.isDeleted ? 'var(--color-text-muted)' : 'var(--color-primary)',
                            textDecoration: node.isDeleted ? 'line-through' : 'none'
                        }}>
                            {node.fullId}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {node.isDeleted && (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(198,40,40,0.1)', color: 'var(--color-danger)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                    已刪除
                                </span>
                            )}
                            {hasChildren && (
                                <span style={{ fontSize: '0.65rem', background: 'var(--color-bg-base)', color: 'var(--color-text-muted)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                    {node.children.length}
                                </span>
                            )}
                        </div>
                    </div>
                    <span style={{
                        fontSize: '0.8rem',
                        color: node.isDeleted ? 'var(--color-text-muted)' : 'var(--color-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {node.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {node.historyCount} 次變更
                    </span>
                </Link>
            </div>

            {/* Accordion Content (Children) */}
            {hasChildren && (
                <div
                    style={{
                        maxHeight: isExpanded ? '2000px' : '0',
                        opacity: isExpanded ? 1 : 0,
                        overflow: 'hidden',
                        transition: 'max-height 0.3s ease, opacity 0.2s ease',
                        paddingLeft: '1rem',
                        marginLeft: '15px',
                        borderLeft: isExpanded ? '2px solid var(--color-border)' : '2px solid transparent',
                        marginTop: isExpanded ? '4px' : '0',
                    }}
                >
                    {node.children.map(child => (
                        <AccordionNode key={child.fullId} node={child} projectId={projectId} pathname={pathname} />
                    ))}
                </div>
            )}
        </div>
    );
}

