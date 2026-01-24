/**
 * @file ProjectSearch.tsx
 * @description 專案詳情頁面搜尋複合元件
 *
 * 整合 `ProjectSearchBar` 與 `SearchResultList`，實現專案內部的全文檢索與結果展示。
 *
 * ## 核心功能
 * - **狀態管理**：管理當前的搜尋結果、載入狀態與搜尋關鍵字。
 * - **行為組裝**：將搜尋條與結果列表串連，提供無縫的專案內容檢索體驗。
 *
 * @see /src/app/projects/[id] - 專案詳情頁面
 */

'use client';

import { useState, useCallback } from 'react';
import ProjectSearchBar from './ProjectSearchBar';
import SearchResultList from './SearchResultList';
import { searchProjectItems, type SearchResult } from '@/actions/search';

interface ProjectSearchProps {
    projectId: number;
}

export default function ProjectSearch({ projectId }: ProjectSearchProps) {
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentQuery, setCurrentQuery] = useState('');

    const handleSearch = useCallback(async (query: string) => {
        setCurrentQuery(query);
        setLoading(true);
        try {
            const searchResults = await searchProjectItems(projectId, query);
            setResults(searchResults);
        } catch (error) {
            console.error('Search error:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    const handleResultsChange = useCallback((newResults: SearchResult[], isLoading: boolean) => {
        setResults(newResults);
        setLoading(isLoading);
        if (newResults.length === 0) {
            setCurrentQuery('');
        }
    }, []);

    return (
        <div style={{ marginBottom: '2rem' }}>
            <ProjectSearchBar
                projectId={projectId}
                onSearch={handleSearch}
                onResultsChange={handleResultsChange}
            />
            <SearchResultList
                results={results}
                query={currentQuery}
                loading={loading}
            />
        </div>
    );
}
