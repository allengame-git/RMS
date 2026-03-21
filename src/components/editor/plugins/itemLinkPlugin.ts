/**
 * @file itemLinkPlugin.ts
 * @description Tiptap 項目連結裝飾 Plugin
 *
 * ProseMirror Plugin，用於在編輯器中高亮顯示潛在的項目連結。
 *
 * ## 核心功能
 * - 掃描文字中的項目編號格式
 * - 為尚未轉換為連結的編號添加裝飾
 * - 提供視覺提示讓使用者知道可以建立連結
 *
 * ## 裝飾邏輯
 * - 使用正規表達式識別項目編號
 * - 跳過已有 `itemLink` Mark 的文字
 * - 為符合格式的文字添加 `item-link-suggestion` class
 *
 * ## 編號格式
 * `/\b((?:[A-Z]+-)+\d+(?:-\d+)*)\b/g`
 * 支援多段前綴：`RMS-1`, `RMS-DAREN-4-1`, `ABC-DEF-1-2-3`
 *
 * ## 使用方式
 * 此 Plugin 由 `ItemLink` 擴充功能自動載入。
 *
 * @see /src/components/editor/extensions/ItemLink.ts - ItemLink 擴充功能
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/** Core regex pattern for item fullId (e.g. RMS-1, RMS-DAREN-4-1). Shared with ItemLink.ts. */
export const ITEM_ID_CORE_PATTERN = '(?:[A-Z]+-)+\\d+(?:-\\d+)*';

const ITEM_ID_REGEX = new RegExp(`\\b(${ITEM_ID_CORE_PATTERN})\\b`, 'g');

/** Build decorations by scanning all text nodes for item ID patterns */
function buildDecorations(doc: any): DecorationSet {
    const decorations: Decoration[] = [];

    doc.descendants((node: any, pos: number) => {
        if (!node.isText || !node.text) return;
        if (node.marks.some((m: any) => m.type.name === 'itemLink')) return;

        const text = node.text;
        let match;
        ITEM_ID_REGEX.lastIndex = 0;

        while ((match = ITEM_ID_REGEX.exec(text)) !== null) {
            const from = pos + match.index;
            const to = from + match[0].length;
            decorations.push(
                Decoration.inline(from, to, {
                    class: 'item-id-candidate',
                    'data-item-id': match[1],
                    title: 'Click to convert to link'
                })
            );
        }
    });

    return DecorationSet.create(doc, decorations);
}

export const itemLinkPlugin = new Plugin({
    key: new PluginKey('itemLinkPlugin'),

    state: {
        init(_config: any, state: any) {
            return buildDecorations(state.doc);
        },
        apply(tr: any, oldSet: DecorationSet) {
            if (!tr.docChanged) {
                return oldSet.map(tr.mapping, tr.doc);
            }
            return buildDecorations(tr.doc);
        },
    },

    props: {
        decorations(state) {
            return this.getState(state) as DecorationSet;
        },

        handleClick(view, pos, event) {
            const { target } = event;
            if (!(target instanceof HTMLElement)) {
                return false;
            }

            const itemId = target.getAttribute('data-item-id');
            if (!itemId || !target.classList.contains('item-id-candidate')) {
                return false;
            }

            // Simple handling: rely on the fact that we can just find the range by searching the text around pos?
            // Actually, we can use the same logic as decorations to find the exact match at this pos.

            const $pos = view.state.doc.resolve(pos);
            const _node = $pos.parent.child($pos.index()); // This gets the node at index in parent

            // Wait, resolving text node is tricky.
            // Let's try to just use input rule for conversion for now to avoid complexity and bugs.
            // But we already have the code structure.

            // If the user accepts that they need to type space, that's fine.
            // The candidate highlight is just a hint "You can link this".

            // Let's implement a quick scan.
            // Start of the block
            const start = $pos.start();
            let foundFrom = -1;
            let foundTo = -1;

            $pos.parent.descendants((node, p) => {
                if (foundFrom !== -1) return false; // stop if found

                if (!node.isText) return;

                const nodeStart = start + p;
                const nodeEnd = nodeStart + node.nodeSize;

                if (pos >= nodeStart && pos <= nodeEnd) {
                    // This is the text node
                    const text = node.text!;
                    ITEM_ID_REGEX.lastIndex = 0;
                    let match;
                    while ((match = ITEM_ID_REGEX.exec(text)) !== null) {
                        const mStart = nodeStart + match.index;
                        const mEnd = mStart + match[0].length;
                        if (pos >= mStart && pos <= mEnd) {
                            foundFrom = mStart;
                            foundTo = mEnd;
                            return false;
                        }
                    }
                }
            });

            if (foundFrom !== -1) {
                const { tr } = view.state;
                tr.addMark(
                    foundFrom,
                    foundTo,
                    view.state.schema.marks.itemLink.create({ fullId: itemId })
                );
                view.dispatch(tr);
                return true;
            }

            return false;
        },
    },
});
