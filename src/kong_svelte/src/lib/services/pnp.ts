import { writable, derived, get } from 'svelte/store';
import { walletsList, createPNP, type PNP, type Wallet, type Adapter } from "@windoge98/plug-n-play"
import type { ActorSubclass } from '@dfinity/agent';

// Export available wallets
export const availableWallets = walletsList;

// Update PNP interface to include prepareConnection
interface PNP {
    account: Wallet.Account | null;
    activeWallet: Adapter.Info | null;
    provider: Adapter.Interface | null;
    config: Wallet.PNPConfig;
    actorCache: Map<string, ActorSubclass<any>>;
    isDev: boolean;
    fetchRootKeys: boolean;
    getActor: <T>(canisterId: string, idl: any, isAnon?: boolean) => Promise<ActorSubclass<T>>;
    connect: (walletId: string) => Promise<Wallet.Account>;
    disconnect: () => Promise<void>;
    isWalletConnected: () => boolean;
    createAnonymousActor: <T>(canisterId: string, idl: any, options?: { requiresSigning?: boolean }) => Promise<ActorSubclass<T>>;
    getAdapter: (walletId: string) => Adapter.Interface;
}

// Create stores
export const selectedWalletId = writable<string | null>(null);
export const pnpInstance = writable<PNP | null>(null);
export const isConnected = writable(false);
export const principalId = writable<string | null>(null);

// Initialize PNP
export const initializePNP = () => {
    const pnp = createPNP({
        hostUrl: 'https://icp0.io',
        isDev: false,
    });
    
    // Create a wrapper that matches the expected interface
    const wrappedPnp: PNP = {
        account: pnp.account,
        activeWallet: pnp.activeWallet,
        provider: pnp.provider,
        config: pnp.config,
        actorCache: pnp.actorCache,
        isDev: pnp.isDev,
        fetchRootKeys: pnp.fetchRootKeys,
        getActor: <T>(canisterId: string, idl: any, isAnon?: boolean) => {
            return pnp.getActor<T>(canisterId, idl, { anon: isAnon });
        },
        connect: (walletId: string) => {
            return pnp.connect(walletId);
        },
        disconnect: () => pnp.disconnect(),
        isWalletConnected: () => pnp.isWalletConnected(),
        createAnonymousActor: <T>(canisterId: string, idl: any, options?: { requiresSigning?: boolean }) => {
            return pnp.createAnonymousActor<T>(canisterId, idl, options);
        },
        getAdapter: (walletId: string) => {
            return pnp.getAdapter(walletId);
        }
    };
    
    pnpInstance.set(wrappedPnp);
    return wrappedPnp;
};

// Disconnect wallet
export const disconnectWallet = async () => {
    const pnp = get(pnpInstance);
    if (!pnp) return;

    try {
        await pnp.disconnect();
        selectedWalletId.set(null);
        isConnected.set(false);
        principalId.set(null);
    } catch (error) {
        console.error('Failed to disconnect wallet:', error);
        throw error;
    }
};

// Initialize PNP on load
initializePNP();

// Connect wallet
export const connectWallet = async (walletId: string) => {
    const pnp = get(pnpInstance);
    if (!pnp) {
        throw new Error('PNP not initialized');
    }

    try {
        const account = await pnp.connect(walletId);
        selectedWalletId.set(walletId);
        isConnected.set(true);
        console.log("account", account);
        principalId.set(account.owner.toString());
        return account;
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        throw error;
    }
};