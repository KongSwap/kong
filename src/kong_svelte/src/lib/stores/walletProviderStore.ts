import { writable, get } from 'svelte/store';
import { auth } from './auth';

type LoginCallback = () => void;

interface WalletProviderState {
  isOpen: boolean;
  onLoginCallback: LoginCallback | null;
}

// Create the initial state
const initialState: WalletProviderState = {
  isOpen: false,
  onLoginCallback: null
};

// Create the store
function createWalletProviderStore() {
  const { subscribe, update, set } = writable<WalletProviderState>(initialState);

  return {
    subscribe,
    
    /**
     * Opens the wallet provider modal
     * @param onLogin Optional callback to execute after successful login
     */
    open: (onLogin?: LoginCallback) => {
      update(state => ({
        ...state,
        isOpen: true,
        onLoginCallback: onLogin || null
      }));
    },
    
    /**
     * Closes the wallet provider modal
     */
    close: () => {
      update(state => ({
        ...state,
        isOpen: false
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
     * @param connectedCallback Function to call if wallet is already connected
     * @param onSuccessfulConnect Function to call after successful connection (if needed)
     */
    ensureConnected: (connectedCallback: () => void, onSuccessfulConnect?: () => void) => {
      const authState = get(auth);
      if (authState.isConnected) {
        // Already connected, just call the callback
        connectedCallback();
      } else {
        // Need to connect first, then call callback on success
        update(state => ({
          ...state,
          isOpen: true,
          onLoginCallback: onSuccessfulConnect || null
        }));
      }
    }
  };
}

// Export a singleton instance of the store
export const walletProviderStore = createWalletProviderStore(); 