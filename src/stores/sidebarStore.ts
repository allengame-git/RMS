import { create } from 'zustand';

interface SidebarState {
    /** 被收摺的 node id set（預設全部展開，只記錄被收起的） */
    collapsedIds: Set<number>;
    toggle: (id: number) => void;
    isExpanded: (id: number) => boolean;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
    collapsedIds: new Set(),
    toggle: (id: number) => {
        set(state => {
            const next = new Set(state.collapsedIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { collapsedIds: next };
        });
    },
    isExpanded: (id: number) => {
        return !get().collapsedIds.has(id);
    },
}));
