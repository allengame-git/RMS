import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const ITEM_ID_REGEX = /\b([A-Z]+-\d+(?:-\d+)*)\b/g;

export const itemLinkPlugin = new Plugin({
    key: new PluginKey('itemLinkPlugin'),

    state: {
        init() {
            return DecorationSet.empty;
        },
        apply(tr, oldState) {
            return oldState.map(tr.mapping, tr.doc);
        },
    },

    props: {
        decorations(state) {
            const decorations: Decoration[] = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
                if (!node.isText || !node.text) {
                    return;
                }

                // Skip if already has itemLink mark
                if (node.marks.some(m => m.type.name === 'itemLink')) {
                    return;
                }

                const text = node.text;
                let match;

                // Reset regex lastIndex
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
            const node = $pos.parent.child($pos.index()); // This gets the node at index in parent

            // Wait, resolving text node is tricky.
            // Let's try to just use input rule for conversion for now to avoid complexity and bugs.
            // But we already have the code structure.

            // If the user accepts that they need to type space, that's fine.
            // The candidate highlight is just a hint "You can link this".

            // Let's implement a quick scan.
            // Start of the block
            let start = $pos.start();
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
