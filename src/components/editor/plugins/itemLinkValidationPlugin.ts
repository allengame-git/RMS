/**
 * @file itemLinkValidationPlugin.ts
 * @description Tiptap 項目連結驗證 Plugin
 *
 * ProseMirror Plugin，用於驗證編輯器中項目連結的有效性。
 *
 * ## 核心功能
 * - 掃描文件中的 `itemLink` Mark
 * - 非同步向 API 驗證連結有效性
 * - 更新連結的 `valid`、`itemId`、`title` 屬性
 * - 快取驗證結果避免重複請求
 *
 * ## 驗證流程
 * 1. 偵測到新的項目連結 Mark
 * 2. 檢查快取是否已有結果
 * 3. 若無，發送 API 請求驗證
 * 4. 收到回應後更新 Mark 屬性
 *
 * ## 快取機制
 * - 使用 `Map<fullId, CachedItemData>` 儲存
 * - 減少重複的 API 請求
 * - 編輯器關閉時快取不會持久化
 *
 * ## 視覺反饋
 * - 有效連結：綠色樣式
 * - 無效連結：紅色樣式
 * - 載入中：預設樣式
 *
 * @see /src/components/editor/extensions/ItemLink.ts - ItemLink 擴充功能
 * @see /src/app/api/items/validate - 驗證 API
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';

interface CachedItemData {
    error?: boolean;
    id?: number;
    title?: string;
    projectTitle?: string;
}

const cache = new Map<string, CachedItemData>();
const pending = new Set<string>();

export const itemLinkValidationPlugin = new Plugin({
    key: new PluginKey('itemLinkValidationPlugin'),

    appendTransaction(transactions, oldState, newState) {
        // Only run if the document has changed or if manually triggered by our fetch
        const docChanged = transactions.some(tr => tr.docChanged);
        const fetchTriggered = transactions.some(tr => tr.getMeta('itemLinkFetch'));

        if (!docChanged && !fetchTriggered) return null;

        const { doc } = newState;
        const tr = newState.tr;
        let modified = false;

        doc.descendants((node, pos) => {
            if (!node.isText) return;

            const mark = node.marks.find((m) => m.type.name === 'itemLink');
            if (mark) {
                const fullId = mark.attrs.fullId;
                if (!fullId) return;

                const cachedData = cache.get(fullId);

                if (cachedData) {
                    // We have data. Check if mark matches data.
                    const currentValid = mark.attrs.valid;
                    const currentTitle = mark.attrs.title;

                    if (cachedData.error) {
                        // Should be invalid
                        if (currentValid !== false) {
                            tr.removeMark(pos, pos + node.nodeSize, mark);
                            tr.addMark(pos, pos + node.nodeSize, mark.type.create({
                                ...mark.attrs,
                                valid: false,
                                title: 'Item not found'
                            }));
                            modified = true;
                        }
                    } else {
                        // Should be valid and have data
                        if (currentTitle !== cachedData.title || currentValid !== true) {
                            tr.removeMark(pos, pos + node.nodeSize, mark);
                            tr.addMark(pos, pos + node.nodeSize, mark.type.create({
                                ...mark.attrs,
                                valid: true,
                                itemId: cachedData.id,
                                title: cachedData.projectTitle ? `${cachedData.title} (${cachedData.projectTitle})` : cachedData.title
                            }));
                            modified = true;
                        }
                    }
                }
            }
        });

        if (modified) return tr;
        return null;
    },

    view(_editorView) {
        return {
            update(view, _prevState) {
                const { state } = view;
                const { doc } = state;

                // Only scan for missing data to initiate fetches
                doc.descendants((node, _pos) => {
                    if (!node.isText) return;
                    const mark = node.marks.find((m) => m.type.name === 'itemLink');
                    if (mark) {
                        const fullId = mark.attrs.fullId;
                        if (!fullId) return;

                        if (!cache.has(fullId) && !pending.has(fullId)) {
                            pending.add(fullId);
                            fetch(`/api/items/lookup?fullId=${fullId}`)
                                .then(res => res.json())
                                .then(data => {
                                    cache.set(fullId, data);
                                    pending.delete(fullId);

                                    // Check if view is still valid before dispatching
                                    if (!view.isDestroyed) {
                                        const transaction = view.state.tr.setMeta('itemLinkFetch', true);
                                        view.dispatch(transaction);
                                    }
                                })
                                .catch(err => {
                                    console.error(err);
                                    cache.set(fullId, { error: true });
                                    pending.delete(fullId);

                                    if (!view.isDestroyed) {
                                        const transaction = view.state.tr.setMeta('itemLinkFetch', true);
                                        view.dispatch(transaction);
                                    }
                                });
                        }
                    }
                });
            }
        };
    }
});
