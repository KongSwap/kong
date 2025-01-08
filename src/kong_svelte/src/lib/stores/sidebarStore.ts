import { writable, derived, get } from 'svelte/store';

interface SidebarState {
    isExpanded: boolean;
    width: number;
    sortBy: 'name' | 'balance' | 'value' | 'price';
    sortDirection: 'asc' | 'desc';
    filterText: string;
    isOpen: boolean;
}

function createSidebarStore() {
    const { subscribe, update, set } = writable<SidebarState>({
        isExpanded: false,  // Always start collapsed
        width: 527,
        sortBy: 'value',
        sortDirection: 'desc',
        filterText: '',
        isOpen: false
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
                isExpanded: !state.isExpanded,  // Actually toggle the state
                isOpen: true,  // Make sure sidebar is open
                width: 527  // Keep consistent width
            }));
        },
        setWidth: (width: number) => {
            update(state => ({ ...state, width: Math.min(width, 527) }));  // Never allow width larger than 527
        },
        setSortBy: (sortBy: 'name' | 'balance' | 'value' | 'price') => {
            update(state => ({
                ...state,
                sortBy,
                sortDirection: state.sortBy === sortBy 
                    ? (state.sortDirection === 'asc' ? 'desc' : 'asc')
                    : 'desc'
            }));
        },
        setFilterText: (filterText: string) => {
            update(state => ({ ...state, filterText }));
        },
        open: () => {
            update(state => ({ ...state, isOpen: true }));
        },
        close: () => {
            update(state => ({ ...state, isOpen: false }));
        },
        toggleOpen: () => {
            update(state => ({ ...state, isOpen: !state.isOpen }));
        },
        collapse: () => {
            update(state => ({ 
                ...state, 
                isExpanded: false, 
                width: 527,
                isOpen: false 
            }));
        }
    };
}

export const sidebarStore = createSidebarStore();
