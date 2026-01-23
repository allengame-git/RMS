'use client';

import { useState, useEffect } from 'react';
import type { SearchResult } from '@/actions/search';

interface ProjectSearchBarProps {
    projectId: number;
    onSearch: (query: string) => void;
    onResultsChange: (results: SearchResult[], loading: boolean) => void;
}

export default function ProjectSearchBar({ projectId: _projectId, onSearch, onResultsChange }: ProjectSearchBarProps) {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');

    // Debounce logic
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Execute search when debounced query changes
    useEffect(() => {
        if (debouncedQuery.length >= 2) {
            onSearch(debouncedQuery);
        } else if (debouncedQuery.length === 0) {
            onResultsChange([], false);
        }
    }, [debouncedQuery, onSearch, onResultsChange]);

    const handleClear = () => {
        setQuery('');
        onResultsChange([], false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            handleClear();
        }
    };

    return (
        <div style={{
            position: 'relative',
            marginBottom: '2rem',
            maxWidth: '800px'
        }}>
            <div style={{ position: 'relative' }}>
                <span style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)',
                    pointerEvents: 'none'
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                </span>

                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="搜尋專案內容 (標題、內容)..."
                    style={{
                        width: '100%',
                        padding: '0.75rem 3rem 0.75rem 3rem',
                        fontSize: '1rem',
                        border: '2px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-surface)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        outline: 'none'
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = 'var(--color-primary)';
                        e.target.style.boxShadow = '0 0 0 3px var(--color-primary-soft)';
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = 'var(--color-border)';
                        e.target.style.boxShadow = 'none';
                    }}
                />

                {query && (
                    <button
                        onClick={handleClear}
                        style={{
                            position: 'absolute',
                            right: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-text-muted)',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'color 0.2s, background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text)';
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="清除搜尋"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>

            {query.length > 0 && query.length < 2 && (
                <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--color-text-muted)'
                }}>
                    請輸入至少 2 個字元進行搜尋
                </div>
            )}
        </div>
    );
}
