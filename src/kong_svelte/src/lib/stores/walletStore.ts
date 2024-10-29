import { writable, type Writable } from 'svelte/store';
import { walletsList, createPNP } from '@windoge98/plug-n-play';
import {
  canisterId as kongBackendCanisterId,
  idlFactory as kongBackendIDL,
} from '../../../../declarations/kong_backend';
import { HttpAgent, Actor, type ActorSubclass } from '@dfinity/agent';
import { backendService } from '$lib/services/backendService';
import { ICRC1_IDL } from "$lib/idls/icrc1.idl.js";
import { ICRC2_IDL } from "$lib/idls/icrc2.idl.js";

// Export the list of available wallets
export const availableWallets = walletsList;

export type CanisterType = 'kong_backend' | 'icrc1' | 'icrc2';

// IDL Mappings
export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  icrc1: ICRC1_IDL,
  icrc2: ICRC2_IDL,
}

// Stores
export const selectedWalletId = writable<string>('');
export const isReady = writable<boolean>(false);
export const userStore: Writable<any> = writable(null);
export const walletStore = writable<{
  account: any | null;
  error: Error | null;
  isConnecting: boolean;
  isConnected: boolean;
}>({
  account: null,
  error: null,
  isConnecting: false,
  isConnected: false,
});

// PNP instance
let pnp: ReturnType<typeof createPNP> | null = null;

// Initialize PNP
function initializePNP() {
  if (pnp === null && typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname.includes('localhost');
    pnp = createPNP({
      hostUrl: isLocalhost ? 'http://localhost:4943' : 'https://ic0.app',
      whitelist: [kongBackendCanisterId],
      identityProvider: isLocalhost
        ? 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943'
        : 'https://identity.ic0.app',
    });
  }
}

// Call initializePNP once when the module is loaded
initializePNP();

// Update wallet store
function updateWalletStore(updates: Partial<{ account: any | null; error: Error | null; isConnecting: boolean; isConnected: boolean; }>) {
  walletStore.update((store) => ({ ...store, ...updates }));
}

// Handle connection errors
function handleConnectionError(error: Error) {
  updateWalletStore({ error, isConnecting: false });
  console.error('Error:', error);
}

// Connect to a wallet
export async function connectWallet(walletId: string) {
  updateWalletStore({ isConnecting: true });

  try {
    const account = await pnp.connect(walletId);

    isReady.set(true);
    updateWalletStore({
      account,
      error: null,
      isConnecting: false,
      isConnected: true,
    });
    localStorage.setItem('selectedWalletId', walletId);
    selectedWalletId.set(walletId);

    const user = await backendService.getWhoami();
    userStore.set(user);
  } catch (error) {
    handleConnectionError(error);
  }
}

// Disconnect from a wallet
export async function disconnectWallet() {
  try {
    await pnp.disconnect();
    updateWalletStore({
      account: null,
      error: null,
      isConnecting: false,
      isConnected: false,
    });
    localStorage.removeItem('selectedWalletId');
    selectedWalletId.set('');
    isReady.set(false);
    userStore.set(null);
  } catch (error) {
    handleConnectionError(error);
  }
}

// Attempt to restore wallet connection on page load
export async function restoreWalletConnection() {
  const storedWalletId = localStorage.getItem('selectedWalletId');
  if (!storedWalletId) return;

  updateWalletStore({ isConnecting: true });
  selectedWalletId.set(storedWalletId);

  try {
    await connectWallet(storedWalletId);
  } catch (error) {
    handleConnectionError(error);
  }
}

// Check if wallet is connected
export async function isConnected(): Promise<boolean> {
  return pnp.isWalletConnected();
}

// Create actor
async function createActor(canisterId: string, idlFactory: any): Promise<ActorSubclass<any>> {
  const isAuthenticated = await isConnected();
  if (isAuthenticated) {
    throw new Error('Wallet not connected.');
  }
  const isLocalhost = window.location.hostname.includes('localhost');
  const host = isLocalhost ? 'http://localhost:4943' : 'https://ic0.app';
  const agent = HttpAgent.createSync({ host });
  if (isLocalhost) {
    await agent.fetchRootKey();
  }
  return isAuthenticated
    ? await pnp.getActor(canisterId, idlFactory)
    : Actor.createActor(idlFactory, { agent, canisterId });
}

// Export function to get the actor
export async function getActor(canisterId = kongBackendCanisterId, canisterType: CanisterType = 'kong_backend'): Promise<ActorSubclass<any>> {
  return await createActor(canisterId, canisterIDLs[canisterType]);
}
