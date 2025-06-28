import { writable, derived, get } from 'svelte/store';
import { browser } from "$app/environment";
import type { WalletInfo, ClickedWalletInfo } from "$lib/config/wallets";
import { 
  mapRawWalletToInfo, 
  groupWalletsByChain, 
  getSortedChains,
  denormalizeWalletId 
} from "$lib/config/wallets";
import { auth, selectedWalletId } from "./auth";
import { recentWalletsStore } from "./recentWalletsStore";
import { isPlugAvailable } from "$lib/utils/browser";

type LoginCallback = () => void;

interface WalletProviderState {
  isOpen: boolean;
  onLoginCallback: LoginCallback | null;
  connecting: boolean;
  connectingWalletId: string | null;
  clickedWalletInfo: ClickedWalletInfo | null;
  errorMessage: string | null;
  searchQuery: string;
  focusedWalletIndex: number;
  showClearConfirm: boolean;
  allWallets: WalletInfo[];
}

// Create the initial state
const initialState: WalletProviderState = {
  isOpen: false,
  onLoginCallback: null,
  connecting: false,
  connectingWalletId: null,
  clickedWalletInfo: null,
  errorMessage: null,
  searchQuery: "",
  focusedWalletIndex: -1,
  showClearConfirm: false,
  allWallets: []
};

function createWalletProviderStore() {
  const { subscribe, set, update } = writable<WalletProviderState>(initialState);

  let connectingTimeout: number | null = null;
  let abortController = new AbortController();

  // Load wallets from auth
  function loadWallets() {
    if (!browser || !auth.pnp) return [];
    
    const adapters = auth.pnp.getEnabledWallets() || {};
    return Object.values(adapters)
      .filter((adapter: any) => adapter.enabled !== false)
      .map(mapRawWalletToInfo);
  }

  // Initialize wallets
  function initialize() {
    const wallets = loadWallets();
    update(state => ({ ...state, allWallets: wallets }));
  }

  // Reset connection state
  function resetConnectionState() {
    if (connectingTimeout) {
      clearTimeout(connectingTimeout);
      connectingTimeout = null;
    }
    abortController.abort();
    
    update(state => ({
      ...state,
      connecting: false,
      connectingWalletId: null,
      clickedWalletInfo: null
    }));
  }

  // Main store interface
  const store = {
    subscribe,
    
    /**
     * Opens the wallet provider modal
     * @param onLogin Optional callback to execute after successful login
     */
    open: (onLogin?: LoginCallback) => {
      initialize();
      update(state => ({
        ...state,
        isOpen: true,
        onLoginCallback: onLogin || null,
        errorMessage: null
      }));
    },
    
    /**
     * Closes the wallet provider modal
     */
    close: () => {
      resetConnectionState();
      update(state => ({
        ...state,
        isOpen: false,
        errorMessage: null,
        searchQuery: "",
        focusedWalletIndex: -1,
        showClearConfirm: false
      }));
    },
    
    /**
     * Executes the login callback if provided and closes the modal
     */
    handleLoginSuccess: () => {
      update(state => {
        if (state.onLoginCallback) {
          state.onLoginCallback();
        }
        return {
          ...state,
          isOpen: false,
          onLoginCallback: null
        };
      });
    },
    
    /**
     * Resets the store to its initial state
     */
    reset: () => {
      set(initialState);
    },
    
    /**
     * Utility method to connect wallet or perform an action if already connected
     */
    ensureConnected: (connectedCallback: () => void, onSuccessfulConnect?: () => void) => {
      const authState = get(auth);
      if (authState.isConnected) {
        connectedCallback();
      } else {
        store.open(onSuccessfulConnect);
      }
    },
    
    // Enhanced methods
    setSearchQuery: (query: string) => {
      update(state => ({ 
        ...state, 
        searchQuery: query,
        focusedWalletIndex: -1 
      }));
    },
    
    setErrorMessage: (message: string | null) => {
      update(state => ({ ...state, errorMessage: message }));
    },
    
    setShowClearConfirm: (show: boolean) => {
      update(state => ({ ...state, showClearConfirm: show }));
    },
    
    setFocusedWalletIndex: (index: number) => {
      update(state => ({ ...state, focusedWalletIndex: index }));
    },
    
    connectWallet: async (walletId: string, source: 'recent' | 'all') => {
      const state = get(store);
      if (!walletId || state.connecting || !browser) return;

      // Check Plug availability
      const denormalizedId = denormalizeWalletId(walletId);
      if (denormalizedId === "plug" && !isPlugAvailable()) {
        update(s => ({
          ...s,
          errorMessage: "Plug Wallet extension is not installed or available. Please install it to connect.",
          connectingWalletId: null
        }));
        return;
      }

      // Reset abort controller
      abortController = new AbortController();

      update(s => ({
        ...s,
        errorMessage: null,
        connecting: true,
        connectingWalletId: denormalizedId,
        clickedWalletInfo: { id: walletId, source }
      }));

      try {
        selectedWalletId.set(walletId);
        await auth.connect(denormalizedId);
        await recentWalletsStore.add(walletId);

        if (get(auth).isConnected) {
          store.handleLoginSuccess();
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Failed to connect wallet:", error);
          update(s => ({
            ...s,
            errorMessage: error instanceof Error 
              ? error.message 
              : "Failed to connect wallet. Please try again."
          }));
          selectedWalletId.set("");
        }
      } finally {
        resetConnectionState();
      }
    }
  };

  return store;
}

// Create and export the store
export const walletProviderStore = createWalletProviderStore();

// Derived store for filtered wallets
export const filteredWallets = derived(
  [walletProviderStore],
  ([$store]) => {
    if (!$store.searchQuery.trim()) {
      return $store.allWallets;
    }

    const query = $store.searchQuery.toLowerCase().trim();
    return $store.allWallets.filter(wallet =>
      wallet.walletName.toLowerCase().includes(query) ||
      wallet.chain.toLowerCase().includes(query) ||
      (wallet.googleSignIn && wallet.googleSignIn.toLowerCase().includes(query))
    );
  }
);

// Derived store for grouped wallets
export const groupedWallets = derived(
  filteredWallets,
  $filtered => {
    const grouped = groupWalletsByChain($filtered);
    const sortedChains = getSortedChains(Object.keys(grouped));
    return { grouped, sortedChains };
  }
);

// Helper to get all wallets as flat array
export function getAllWalletsFlat(): WalletInfo[] {
  const { grouped, sortedChains } = get(groupedWallets);
  return sortedChains.flatMap(chain => grouped[chain] || []);
}