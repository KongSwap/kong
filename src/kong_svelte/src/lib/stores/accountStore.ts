import { writable } from 'svelte/store';

interface AccountStoreState {
    showDetails: boolean;
    activeTab: 'principal' | 'account';
}

function createAccountStore() {
    const { subscribe, update, set } = writable<AccountStoreState>({
        showDetails: false,
        activeTab: 'principal'
    });

    return {
        subscribe,
        showAccountDetails: (tab: AccountStoreState['activeTab'] = 'principal') => {
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
