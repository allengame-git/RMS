'use client';

import { useState } from 'react';
import Link from 'next/link';
import { addRelatedItem, removeRelatedItem } from '@/actions/item-relations';

interface RelatedItem {
    id: number;
    fullId: string;
    title: string;
    projectId: number;
}

interface RelatedItemsManagerProps {
    sourceItemId?: number; // Optional now
    initialRelatedItems: RelatedItem[];
    onChange?: (items: RelatedItem[]) => void; // New prop for draft mode
    canEdit?: boolean;
}

export default function RelatedItemsManager({ sourceItemId, initialRelatedItems, onChange, canEdit = true }: RelatedItemsManagerProps) {
    const [relatedItems, setRelatedItems] = useState<RelatedItem[]>(initialRelatedItems);
    const [newItemId, setNewItemId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemId.trim()) return;

        setIsLoading(true);
        setError('');

        try {
            // If in draft mode (onChange provided), we just validate existence via API
            if (onChange) {
                // We need a way to lookup item by fullId. 
                // We can use the lookup API we created for the editor extensions.
                const response = await fetch(`/api/items/lookup?fullId=${newItemId.trim()}`);
                if (!response.ok) {
                    const data = await response.json();
                    setError(data.error || 'Item not found');
                    return;
                }
                const itemData = await response.json();

                // Check duplicates locally
                if (relatedItems.some(i => i.id === itemData.id)) {
                    setError('Item already related');
                    return;
                }

                const newItem: RelatedItem = {
                    id: itemData.id,
                    fullId: itemData.fullId,
                    title: itemData.title,
                    projectId: itemData.projectId
                };

                const updated = [...relatedItems, newItem];
                setRelatedItems(updated);
                onChange(updated);
                setNewItemId('');
            } else {
                // Existing Server Action Logic
                if (!sourceItemId) return;
                const result = await addRelatedItem(sourceItemId, newItemId.trim());
                if (result.success) {
                    setNewItemId('');
                    window.location.reload();
                } else {
                    setError(result.error || 'Failed to add item');
                }
            }
        } catch (err) {
            console.error(err);
            setError('An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemove = async (targetId: number) => {
        if (!confirm('Are you sure you want to remove this relation?')) return;

        if (onChange) {
            const updated = relatedItems.filter(item => item.id !== targetId);
            setRelatedItems(updated);
            onChange(updated);
        } else {
            if (!sourceItemId) return;
            setIsLoading(true);
            try {
                const result = await removeRelatedItem(sourceItemId, targetId);
                if (result.success) {
                    window.location.reload();
                } else {
                    setError(result.error || 'Failed to remove item');
                }
            } catch (err) {
                setError('An error occurred');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div style={{ marginTop: '2rem' }} className="glass">
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Related Items</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {relatedItems.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No related items.</p>}

                {relatedItems.map(item => (
                    <div key={item.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        backgroundColor: 'rgba(0,0,0,0.02)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {/* In draft mode, we might not want clickable links if they navigate away? 
                                Or open in new tab? Let's keep it consistent. */}
                            <Link href={`/items/${item.id}`} target="_blank" style={{ fontWeight: 'bold', fontFamily: 'var(--font-geist-mono)', color: 'var(--color-primary)' }}>
                                {item.fullId}
                            </Link>
                            <span>{item.title}</span>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => handleRemove(item.id)}
                                disabled={isLoading}
                                style={{
                                    color: 'var(--color-danger, #ef4444)',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid currentColor',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem'
                                }}
                            >
                                Remove
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {canEdit && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        value={newItemId}
                        onChange={(e) => setNewItemId(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault(); // Prevent submit of parent form
                                // Only trigger add if we have a value. 
                                // Creating a synthetic event is tricky for handleAdd(e: React.FormEvent).
                                // Let's modify handleAdd to not rely on event or just pass null/mock.
                                // But handleAdd calls e.preventDefault().
                                // So let's just create a wrapper or refactor handleAdd.
                                // Simplest: pass a dummy object with preventDefault.
                                if (newItemId.trim()) handleAdd({ preventDefault: () => { } } as React.FormEvent);
                            }
                        }}
                        placeholder="Enter Item ID (e.g. WQ-1)"
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)'
                        }}
                    />
                    <button
                        type="button"
                        onClick={(e) => handleAdd(e as unknown as React.FormEvent)}
                        disabled={isLoading || !newItemId.trim()}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: 'var(--color-primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: isLoading ? 0.7 : 1
                        }}
                    >
                        {isLoading ? 'Adding...' : 'Add Relation'}
                    </button>
                </div>
            )}
            {error && <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.9rem' }}>{error}</p>}
            {error && <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.9rem' }}>{error}</p>}
        </div>
    );
}
