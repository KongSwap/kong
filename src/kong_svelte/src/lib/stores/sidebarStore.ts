import { writable, derived } from 'svelte/store';

interface SidebarState {
    isExpanded: boolean;
    width: number;
    sortBy: 'name' | 'balance' | 'value' | 'price';
    sortDirection: 'asc' | 'desc';
    filterText: string;
}

function createSidebarStore() {
    const { subscribe, update, set } = writable<SidebarState>({
        isExpanded: false,
        width: 527,
        sortBy: 'value',
        sortDirection: 'desc',
        filterText: ''
    });

    const isExpanded = derived(
        { subscribe },
        $state => $state.isExpanded
    );

    return {
        subscribe,
        isExpanded,
        toggleExpand: () => {
            update(state => ({
                ...state,
                isExpanded: !state.isExpanded,
                width: state.isExpanded ? 527 : window.innerWidth - 32 // 1rem margin on each side (16px * 2)
            }));
        },
        setWidth: (width: number) => {
            update(state => ({ ...state, width }));
        },
        setSortBy: (sortBy: 'name' | 'balance' | 'value' | 'price') => {
            update(state => ({
                ...state,
                sortBy,
                // If clicking the same sort option, toggle direction
                sortDirection: state.sortBy === sortBy 
                    ? (state.sortDirection === 'asc' ? 'desc' : 'asc')
                    : 'desc'
            }));
        },
        setFilterText: (filterText: string) => {
            update(state => ({ ...state, filterText }));
        },
        collapse: () => {
            update(state => ({ ...state, isExpanded: false, width: 527 }));
        }
    };
}

export const sidebarStore = createSidebarStore();
