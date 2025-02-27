import { writable } from 'svelte/store';

interface KeyboardShortcutsStore {
  isHelpOpen: boolean;
}

function createKeyboardShortcutsStore() {
  const { subscribe, set, update } = writable<KeyboardShortcutsStore>({
    isHelpOpen: false
  });

  return {
    subscribe,
    openHelp: () => update(state => ({ ...state, isHelpOpen: true })),
    closeHelp: () => update(state => ({ ...state, isHelpOpen: false })),
    toggleHelp: () => update(state => ({ ...state, isHelpOpen: !state.isHelpOpen }))
  };
}

export const keyboardShortcutsStore = createKeyboardShortcutsStore(); 