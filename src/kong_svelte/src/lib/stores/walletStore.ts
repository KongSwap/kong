import { writable } from 'svelte/store';
import { walletsList } from '@windoge98/plug-n-play';
import { backendService } from '$lib/services/backendService';

// Svelte store to manage wallet state
export const walletStore = writable<{
  account: any | null;
  error: Error | null;
  isConnecting: boolean;
}>({
  account: null,
  error: null,
  isConnecting: false,
});

// Store for selectedWalletId
export const selectedWalletId = writable<string>('');

// Export the list of available wallets
export const availableWallets = walletsList;

// Connect to a wallet
export async function connectWallet(walletId: string) {
  walletStore.update((store) => ({ ...store, isConnecting: true }));

  try {
    // Connect to the wallet
    const account = await backendService.connectWallet(walletId);

    // Now initialize the backend actors
    await backendService.initializeActors();

    walletStore.set({
      account,
      error: null,
      isConnecting: false,
    });
    localStorage.setItem('selectedWalletId', walletId);
    selectedWalletId.set(walletId); // Update the store
  } catch (error) {
    walletStore.update((store) => ({ ...store, error, isConnecting: false }));
    console.error('Error connecting to wallet:', error);
  }
}

// Disconnect from a wallet
export async function disconnectWallet() {
  try {
    await backendService.disconnectWallet();
    walletStore.set({
      account: null,
      error: null,
      isConnecting: false,
    });
    localStorage.removeItem('selectedWalletId');
    selectedWalletId.set('');
  } catch (error) {
    walletStore.update((store) => ({ ...store, error }));
    console.error('Error disconnecting from wallet:', error);
  }
}

// Attempt to restore wallet connection on page load
export async function restoreWalletConnection() {
  const storedWalletId = localStorage.getItem('selectedWalletId');
  if (!storedWalletId) return;

  walletStore.update((store) => ({ ...store, isConnecting: true }));
  selectedWalletId.set(storedWalletId);

  try {
    // Connect the wallet first
    const account = await backendService.connectWallet(storedWalletId);

    // Now initialize the backend actors
    await backendService.initializeActors();

    walletStore.set({
      account,
      error: null,
      isConnecting: false,
    });
  } catch (error) {
    walletStore.update((store) => ({ ...store, error, isConnecting: false }));
    console.error('Error restoring wallet connection:', error);
  }
}
