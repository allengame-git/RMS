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
    currentItemId?: number;
}

export default function ItemTree({ nodes, level = 0, canEdit = false, projectId, currentItemId }: ItemTreeProps) {
    if (!nodes || nodes.length === 0) return null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: level === 0 ? '0.75rem' : '0.5rem',
            paddingLeft: level > 0 ? '1.5rem' : '0'
        }}>
            {nodes.map(node => (
                <AccordionItem
                    key={node.id}
                    node={node}
                    level={level}
                    canEdit={canEdit}
                    projectId={projectId}
                    currentItemId={currentItemId}
                />
            ))}
        </div>
    );
}

interface AccordionItemProps {
    node: ItemNode;
    level: number;
    canEdit: boolean;
    projectId?: number;
    currentItemId?: number;
}

function AccordionItem({ node, level, canEdit, projectId, currentItemId }: AccordionItemProps) {
    const hasChildren = node.children && node.children.length > 0;
    const [isExpanded, setIsExpanded] = useState(level === 0);
    const isCurrentItem = currentItemId === node.id;
    const isRootLevel = level === 0;

    return (
        <div
            className="accordion-panel"
            style={{
                borderRadius: isRootLevel ? 'var(--radius-md)' : 'var(--radius-sm)',
                border: isRootLevel
                    ? '1px solid var(--color-border)'
                    : '1px solid transparent',
                backgroundColor: isRootLevel
                    ? 'var(--color-bg-surface)'
                    : 'transparent',
                boxShadow: isRootLevel
                    ? '0 1px 3px rgba(0,0,0,0.05)'
                    : 'none',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
            }}
        >
            {/* Accordion Header */}
            <div
                className={`accordion-header ${isCurrentItem ? 'current' : ''}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: isRootLevel ? '1rem 1.25rem' : '0.6rem 0.75rem',
                    cursor: hasChildren ? 'pointer' : 'default',
                    backgroundColor: isCurrentItem
                        ? 'var(--color-primary-soft)'
                        : 'transparent',
                    borderLeft: isCurrentItem
                        ? '4px solid var(--color-primary)'
                        : '4px solid transparent',
                    transition: 'all 0.15s ease',
                }}
                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
            >
                {/* Expand/Collapse Icon */}
                <span
                    style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: hasChildren
                            ? 'var(--color-bg-elevated)'
                            : 'transparent',
                        color: hasChildren
                            ? 'var(--color-text-muted)'
                            : 'transparent',
                        transition: 'transform 0.2s ease, background-color 0.15s',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        flexShrink: 0,
                        fontSize: '0.75rem',
                    }}
                >
                    {hasChildren ? '▶' : ''}
                </span>

                {/* Item ID Badge */}
                <Link
                    href={`/items/${node.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        fontFamily: 'var(--font-geist-mono)',
                        fontWeight: 600,
                        fontSize: isRootLevel ? '0.9rem' : '0.85rem',
                        color: 'white',
                        backgroundColor: 'var(--color-primary)',
                        padding: '0.25rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        textDecoration: 'none',
                        transition: 'opacity 0.15s',
                        flexShrink: 0,
                    }}
                    className="item-id-badge"
                >
                    {node.fullId}
                </Link>

                {/* Title */}
                <Link
                    href={`/items/${node.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        flex: 1,
                        fontWeight: isRootLevel ? 600 : 500,
                        fontSize: isRootLevel ? '1rem' : '0.95rem',
                        color: 'var(--color-text)',
                        textDecoration: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                    className="item-title-link"
                >
                    {node.title}
                </Link>

                {/* Child Count Badge */}
                {hasChildren && (
                    <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        backgroundColor: 'var(--color-bg-elevated)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        flexShrink: 0,
                    }}>
                        {node.children.length} 個子項目
                    </span>
                )}

                {/* Add Child Button */}
                {canEdit && projectId && (
                    <div onClick={(e) => e.stopPropagation()}>
                        <CreateItemForm
                            projectId={projectId}
                            parentId={node.id}
                            modal={true}
                            trigger={
                                <button
                                    title="新增子項目"
                                    className="add-child-btn"
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-surface)',
                                        cursor: 'pointer',
                                        color: 'var(--color-text-muted)',
                                        fontSize: '1rem',
                                        transition: 'all 0.15s ease',
                                        flexShrink: 0,
                                    }}
                                >
                                    +
                                </button>
                            }
                        />
                    </div>
                )}
            </div>

            {/* Accordion Content (Children) */}
            <div
                className="accordion-content"
                style={{
                    maxHeight: isExpanded ? '2000px' : '0',
                    opacity: isExpanded ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease, opacity 0.2s ease',
                    borderTop: hasChildren && isExpanded
                        ? '1px solid var(--color-border)'
                        : 'none',
                    backgroundColor: isRootLevel
                        ? 'rgba(0,0,0,0.02)'
                        : 'transparent',
                }}
            >
                {hasChildren && isExpanded && (
                    <div style={{ padding: isRootLevel ? '1rem' : '0.5rem 0 0.5rem 0' }}>
                        <ItemTree
                            nodes={node.children}
                            level={level + 1}
                            canEdit={canEdit}
                            projectId={projectId}
                            currentItemId={currentItemId}
                        />
                    </div>
                )}
            </div>

            <style jsx>{`
                .accordion-panel:hover {
                    border-color: var(--color-border-hover, var(--color-border));
                }
                .accordion-header:hover {
                    background-color: rgba(0,0,0,0.02);
                }
                .accordion-header.current:hover {
                    background-color: var(--color-primary-soft);
                }
                .item-id-badge:hover {
                    opacity: 0.85;
                }
                .item-title-link:hover {
                    color: var(--color-primary);
                }
                .add-child-btn:hover {
                    background-color: var(--color-primary) !important;
                    color: white !important;
                    border-color: var(--color-primary) !important;
                }
            `}</style>
        </div>
    );
}
