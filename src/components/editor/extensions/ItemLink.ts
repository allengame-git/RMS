
import { Mark, mergeAttributes, InputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { itemLinkPlugin } from '../plugins/itemLinkPlugin';
import { itemLinkValidationPlugin } from '../plugins/itemLinkValidationPlugin';

export interface ItemLinkOptions {
    HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        itemLink: {
            setItemLink: (fullId: string) => ReturnType;
            unsetItemLink: () => ReturnType;
        };
    }
}

export const ItemLink = Mark.create<ItemLinkOptions>({
    name: 'itemLink',

    priority: 1000,

    inclusive: false,

    addOptions() {
        return {
            HTMLAttributes: {
                class: 'item-link',
            },
        };
    },

    addAttributes() {
        return {
            fullId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-item-id'),
                renderHTML: (attributes) => {
                    if (!attributes.fullId) {
                        return {};
                    }
                    return {
                        'data-item-id': attributes.fullId,
                        href: `/items/${attributes.itemId || '#'}`,
                        title: attributes.title ? `${attributes.title} (${attributes.fullId})` : attributes.fullId,
                        target: '_blank',
                    };
                },
            },
            itemId: {
                default: null,
            },
            title: {
                default: null,
            },
            valid: {
                default: true,
                parseHTML: (element) => element.classList.contains('valid'),
                renderHTML: (attributes) => {
                    return {
                        class: attributes.valid ? 'item-link valid' : 'item-link invalid',
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'a[data-item-id]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setItemLink:
                (fullId: string) =>
                    ({ commands }) => {
                        return commands.setMark(this.name, { fullId });
                    },
            unsetItemLink:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name);
                    },
        };
    },

    addInputRules() {
        return [
            new InputRule({
                find: /([A-Z]+-\d+(?:-\d+)*)\s$/,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const start = range.from;
                    const end = range.to;
                    const fullId = match[1];

                    if (fullId) {
                        tr.addMark(
                            start,
                            end,
                            state.schema.marks.itemLink.create({ fullId })
                        );

                        // Insert the space that triggered the rule, but remove the mark from it
                        tr.insertText(' ');
                    }
                },
            }),
        ];
    },

    addProseMirrorPlugins() {
        const clickHandler = new Plugin({
            key: new PluginKey('itemLinkClickHandler'),
            props: {
                handleClick(view, pos, event) {
                    const { target } = event;
                    if (!(target instanceof HTMLElement)) {
                        return false;
                    }

                    const link = target.closest('a');
                    if (link && link.classList.contains('item-link')) {
                        // Check if it's a valid link with href
                        // Relaxed check: allow any href that is not empty
                        if (link.href) {
                            // prevent editor from handling the click (placing cursor)
                            event.preventDefault();

                            if (link.getAttribute('href')?.endsWith('#')) {
                                console.warn('ItemLink invalid or loading (href ends with #)');
                                alert('Item link is loading or invalid.');
                                return true;
                            }

                            window.open(link.href, '_blank');
                            return true;
                        }
                    }
                    return false;
                }
            }
        });

        return [itemLinkPlugin, itemLinkValidationPlugin, clickHandler];
    },
});
