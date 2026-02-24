/**
 * @file SidebarNav.tsx
 * @description 側邊欄導航元件
 *
 * 項目詳情頁面的精簡樹狀導航，採用緊湊的設計風格。
 *
 * ## 核心功能
 * - 緊湊的樹狀項目顯示
 * - 當前項目高亮
 * - 可展開/摺疊節點
 * - 新增子項目按鈕
 *
 * ## 與 ItemTree 的差異
 * | 特性 | SidebarNav | ItemTree |
 * |------|-----------|----------|
 * | 設計風格 | 緊湊精簡 | 完整手風琴 |
 * | 使用場景 | 項目詳情左側 | 專案頁面 |
 * | 間距 | 較小 | 較大 |
 *
 * ## Props
 * - `nodes`：樹狀節點資料
 * - `level`：當前層級
 * - `currentItemId`：當前項目 ID（高亮顯示）
 * - `canEdit`：是否可編輯
 * - `projectId`：專案 ID
 *
 * @see /src/components/item/ItemTree.tsx - 完整版樹狀元件
 * @see /src/app/items/[id]/page.tsx - 項目詳情頁面
 */

'use client';

import { ItemNode } from '@/lib/tree-utils';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CreateItemForm from './CreateItemForm';

interface SidebarNavProps {
    nodes: ItemNode[];
    level?: number;
    currentItemId?: number;
    canEdit?: boolean;
    projectId?: number;
}

/**
 * Simplified sidebar navigator for item detail pages
 * Uses compact tree-style display without heavy accordion styling
 */
export default function SidebarNav({ nodes, level = 0, currentItemId, canEdit = false, projectId }: SidebarNavProps) {
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
                    canEdit={canEdit}
                    projectId={projectId}
                />
            ))}
        </div>
    );
}



interface SidebarNavItemProps {
    node: ItemNode;
    level: number;
    currentItemId?: number;
    canEdit?: boolean;
    projectId?: number;
}

function SidebarNavItem({ node, level, currentItemId, canEdit = false, projectId }: SidebarNavItemProps) {
    const router = useRouter();
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
                <a
                    href={`/items/${node.id}`}
                    onClick={(e) => {
                        e.preventDefault();
                        router.push(`/items/${node.id}`, { scroll: false });
                    }}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1px',
                        textDecoration: 'none',
                        color: 'inherit',
                        minWidth: 0,
                        cursor: 'pointer',
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
                </a>

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
                                        width: '20px',
                                        height: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '4px',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-surface)',
                                        cursor: 'pointer',
                                        color: 'var(--color-primary)',
                                        fontSize: '0.9rem',
                                        fontWeight: 'bold',
                                        transition: 'all 0.15s ease',
                                        flexShrink: 0,
                                        opacity: 0.7,
                                    }}
                                >
                                    +
                                </button>
                            }
                        />
                    </div>
                )}
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
                <SidebarNav
                    nodes={node.children}
                    level={level + 1}
                    currentItemId={currentItemId}
                    canEdit={canEdit}
                    projectId={projectId}
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
                .sidebar-nav-item:hover .add-child-btn {
                    opacity: 1;
                }
            `}</style>
        </div>
    );
}

