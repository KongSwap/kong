import { writable, type Writable } from 'svelte/store';
import { walletsList, createPNP } from '@windoge98/plug-n-play';
import {
  canisterId as kongBackendCanisterId,
  idlFactory as kongBackendIDL,
} from '../../../../declarations/kong_backend'; 
import {
  idlFactory as kongFaucetIDL,
  canisterId as kongFaucetCanisterId,
} from '../../../../declarations/kong_faucet';
import { HttpAgent, Actor, type ActorSubclass } from '@dfinity/agent';
import { UserService } from '$lib/services/UserService';
import { ICRC1_IDL } from '$lib/idls/icrc1.idl.js';
import { ICRC2_IDL } from '$lib/idls/icrc2.idl.js';
import { browser } from '$app/environment';

// Export the list of available wallets
export const availableWallets = walletsList;

// IDL Mappings
export type CanisterType = 'kong_backend' | 'icrc1' | 'icrc2' | 'kong_faucet';
export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
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
export function initializePNP() {
  if (pnp === null && typeof window !== 'undefined') {
    const isLocalEnv = process.env.DFX_NETWORK === 'local';
    pnp = createPNP({
      hostUrl: isLocalEnv ? 'http://localhost:4943' : 'https://ic0.app',
      whitelist: [kongBackendCanisterId, kongFaucetCanisterId],
      identityProvider: isLocalEnv
        ? 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943'
        : 'https://identity.ic0.app',
    });
  }
}

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

    const user = await UserService.getWhoami();
    userStore.set(user);
  } catch (error) {
    handleConnectionError(error);
  }
}

// Disconnect from a wallet
export async function disconnectWallet() {
  initializePNP();
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
  initializePNP();
  if(browser) {
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
}

// Check if wallet is connected
export function isConnected(): boolean {
  initializePNP();
  return pnp ? pnp.isWalletConnected() : false;
}

// Create actor
async function createActor(canisterId: string, idlFactory: any): Promise<ActorSubclass<any>> {
  if(browser) {
    const isAuthenticated = isConnected();
    const isLocalEnv = window.location.hostname.includes('localhost');
    const host = isLocalEnv ? 'http://localhost:4943' : 'https://ic0.app';
    const agent = HttpAgent.createSync({ host });
    if (isLocalEnv) {
    await agent.fetchRootKey();
  }
  return isAuthenticated
    ? await pnp.getActor(canisterId, idlFactory)
    : Actor.createActor(idlFactory, { agent, canisterId });
  }
}

// Export function to get the actor
export async function getActor(canisterId = kongBackendCanisterId, canisterType: CanisterType = 'kong_backend'): Promise<ActorSubclass<any>> {
  initializePNP();
  return await createActor(canisterId, canisterIDLs[canisterType]);
}
