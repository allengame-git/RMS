'use client';

import { ItemNode } from '@/lib/tree-utils';
import Link from 'next/link';
import { useState } from 'react';

interface SidebarNavProps {
    nodes: ItemNode[];
    level?: number;
    currentItemId?: number;
}

/**
 * Simplified sidebar navigator for item detail pages
 * Uses compact tree-style display without heavy accordion styling
 */
export default function SidebarNav({ nodes, level = 0, currentItemId }: SidebarNavProps) {
    if (!nodes || nodes.length === 0) return null;

    return (
        <div style={{
            paddingLeft: level > 0 ? '1rem' : '0',
            borderLeft: level > 0 ? '1px solid var(--color-border)' : 'none',
        }}>
            {nodes.map(node => (
                <SidebarNavItem
                    key={node.id}
                    node={node}
                    level={level}
                    currentItemId={currentItemId}
                />
            ))}
        </div>
    );
}

interface SidebarNavItemProps {
    node: ItemNode;
    level: number;
    currentItemId?: number;
}

function SidebarNavItem({ node, level, currentItemId }: SidebarNavItemProps) {
    const hasChildren = node.children && node.children.length > 0;
    const [isExpanded, setIsExpanded] = useState(true);
    const isCurrentItem = currentItemId === node.id;

    return (
        <div style={{ marginBottom: '2px' }}>
            {/* Item Row */}
            <div
                className={`sidebar-nav-item ${isCurrentItem ? 'current' : ''}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isCurrentItem ? 'var(--color-primary-soft)' : 'transparent',
                    borderLeft: isCurrentItem ? '3px solid var(--color-primary)' : '3px solid transparent',
                    transition: 'all 0.15s ease',
                    marginLeft: isCurrentItem ? '-3px' : '0',
                }}
            >
                {/* Expand/Collapse Toggle */}
                {hasChildren ? (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0',
                            width: '14px',
                            height: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-text-muted)',
                            fontSize: '0.6rem',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            flexShrink: 0,
                        }}
                        title={isExpanded ? '折疊' : '展開'}
                    >
                        ▶
                    </button>
                ) : (
                    <span style={{ width: '14px', flexShrink: 0 }} />
                )}

                {/* Item Link */}
                <Link
                    href={`/items/${node.id}`}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1px',
                        textDecoration: 'none',
                        color: 'inherit',
                        minWidth: 0,
                    }}
                    className="sidebar-item-link"
                >
                    {/* ID */}
                    <span style={{
                        fontFamily: 'var(--font-geist-mono)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: isCurrentItem ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    }}>
                        {node.fullId}
                    </span>
                    {/* Title */}
                    <span style={{
                        fontSize: '0.85rem',
                        fontWeight: isCurrentItem ? 600 : 400,
                        color: 'var(--color-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {node.title}
                    </span>
                </Link>

                {/* Child count indicator */}
                {hasChildren && (
                    <span style={{
                        fontSize: '0.65rem',
                        color: 'var(--color-text-muted)',
                        backgroundColor: 'var(--color-bg-elevated)',
                        padding: '1px 5px',
                        borderRadius: '999px',
                        flexShrink: 0,
                    }}>
                        {node.children.length}
                    </span>
                )}
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
                <SidebarNav
                    nodes={node.children}
                    level={level + 1}
                    currentItemId={currentItemId}
                />
            )}

            <style jsx>{`
                .sidebar-nav-item:hover {
                    background-color: rgba(0,0,0,0.03);
                }
                .sidebar-nav-item.current:hover {
                    background-color: var(--color-primary-soft);
                }
                .sidebar-item-link:hover span:last-child {
                    color: var(--color-primary);
                }
            `}</style>
        </div>
    );
}
