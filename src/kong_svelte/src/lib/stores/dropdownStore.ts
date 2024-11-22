import { writable } from 'svelte/store';

type DropdownState = {
    isOpen: boolean;
    direction: 'up' | 'down';
    position: { x: number; y: number };
    width: number;
    buttonRect: DOMRect | null;
    tokens: FE.Token[];
    onSelect: ((token: FE.Token) => void) | null;
    excludeTokens: string[];
};

const initialState: DropdownState = {
    isOpen: false,
    direction: 'down',
    position: { x: 0, y: 0 },
    width: 0,
    buttonRect: null,
    tokens: [],
    onSelect: null,
    excludeTokens: [],
};

export const dropdownStore = writable<DropdownState>(initialState);

export function closeDropdown() {
    dropdownStore.update(state => ({ ...state, isOpen: false }));
}
