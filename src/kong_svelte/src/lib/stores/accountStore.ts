import { writable } from 'svelte/store';

interface AccountStoreState {
    showDetails: boolean;
    activeTab: 'identity' | 'wallet' | 'connection' | 'details';
}

function createAccountStore() {
    const { subscribe, update, set } = writable<AccountStoreState>({
        showDetails: false,
        activeTab: 'identity'
    });

    return {
        subscribe,
        showAccountDetails: (tab: AccountStoreState['activeTab'] = 'identity') => {
            update(state => ({ ...state, showDetails: true, activeTab: tab }));
        },
        hideAccountDetails: () => {
            update(state => ({ ...state, showDetails: false }));
        },
        setActiveTab: (tab: AccountStoreState['activeTab']) => {
            update(state => ({ ...state, activeTab: tab }));
        }
    };
}

export const accountStore = createAccountStore();
