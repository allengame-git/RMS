'use client';

import { useState, useCallback } from 'react';
import { ItemNode } from '@/lib/tree-utils';
import { getDeletedItems } from '@/actions/item-restore';
import RestoreItemDialog from './RestoreItemDialog';

interface DeletedItem {
  id: number;
  fullId: string;
  title: string;
  parentId: number | null;
  updatedAt: Date;
}

interface DeletedItemsSectionProps {
  projectId: number;
  treeNodes: ItemNode[];
}

export default function DeletedItemsSection({ projectId, treeNodes }: DeletedItemsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreItem, setRestoreItem] = useState<DeletedItem | null>(null);

  const fetchDeletedItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDeletedItems(projectId);
      if (result.success && result.data) {
        setItems(result.data.items.map(item => ({
          ...item,
          updatedAt: new Date(item.updatedAt),
        })));
      } else {
        setError(result.error ?? '取得已刪除項目失敗');
      }
    } catch {
      setError('取得已刪除項目失敗');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      fetchDeletedItems();
    }
  };

  const handleRestoreClose = (restored?: boolean) => {
    setRestoreItem(null);
    if (restored) {
      fetchDeletedItems();
    }
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          cursor: 'pointer',
          userSelect: 'none',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            fontSize: '0.85rem',
          }}
        >
          ▶
        </span>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>已刪除項目</span>
        {expanded && !loading && (
          <span
            style={{
              fontSize: '0.8rem',
              padding: '0.1rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-text-muted)',
              color: 'var(--color-bg-surface)',
              fontWeight: 600,
            }}
          >
            {items.length}
          </span>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
              }}
            >
              載入中...
            </div>
          ) : error ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--color-danger, #dc3545)',
              }}
            >
              {error}
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
              }}
            >
              沒有已刪除的項目
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {/* fullId badge */}
                <span
                  style={{
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: '0.85rem',
                    color: 'var(--color-text-muted)',
                    textDecoration: 'line-through',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    flexShrink: 0,
                  }}
                >
                  {item.fullId}
                </span>

                {/* Title */}
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title}
                </span>

                {/* Deletion time */}
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--color-text-muted)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.updatedAt.toLocaleString('zh-TW')}
                </span>

                {/* Restore button */}
                <button
                  onClick={() => setRestoreItem(item)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-primary)',
                    background: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  還原
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Restore dialog */}
      {restoreItem && (
        <RestoreItemDialog
          itemId={restoreItem.id}
          itemFullId={restoreItem.fullId}
          itemTitle={restoreItem.title}
          projectId={projectId}
          treeNodes={treeNodes}
          onClose={handleRestoreClose}
        />
      )}
    </div>
  );
}
