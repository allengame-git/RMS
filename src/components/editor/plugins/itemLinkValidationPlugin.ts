import { Plugin, PluginKey } from '@tiptap/pm/state';

const cache = new Map<string, any>();
const pending = new Set<string>();

export const itemLinkValidationPlugin = new Plugin({
    key: new PluginKey('itemLinkValidationPlugin'),

    appendTransaction(transactions, oldState, newState) {
        // Only run if the document has changed or if manually triggered by our fetch
        const docChanged = transactions.some(tr => tr.docChanged);
        const fetchTriggered = transactions.some(tr => tr.getMeta('itemLinkFetch'));

        if (!docChanged && !fetchTriggered) return null;

        const { doc } = newState;
        let tr = newState.tr;
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

    view(editorView) {
        return {
            update(view, prevState) {
                const { state } = view;
                const { doc } = state;

                // Only scan for missing data to initiate fetches
                doc.descendants((node, pos) => {
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
