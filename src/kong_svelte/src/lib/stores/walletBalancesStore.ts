// src/kong_svelte/src/lib/services/tokens/walletBalancesStore.ts
import { get, writable } from "svelte/store";
import { TokenService } from "$lib/services/tokens/TokenService";
import type { TokenBalance } from "$lib/services/tokens/types";

// Create the stores
export const walletBalancesStore = writable<Record<string, FE.TokenBalance>>({});
export const currentWalletStore = writable<string | null>(null);

export const getStoredWalletBalances = async (walletId: string) => {
  if (!walletId || walletId === "anonymous") {
    return {};
  }

  try {
    const storedBalances = get(walletBalancesStore);
    const currentWallet = get(currentWalletStore);

    // If requesting balances for a different wallet, return empty
    if (currentWallet !== walletId) {
      return {};
    }

    return Object.entries(storedBalances).reduce(
      (acc, [canisterId, balance]: [string, TokenBalance]) => {
        acc[canisterId] = {
          in_tokens: balance.in_tokens,
          in_usd: balance.in_usd,
        };
        return acc;
      },
      {} as Record<string, FE.TokenBalance>,
    );
  } catch (error) {
    console.error("Error getting stored wallet balances:", error);
    return {};
  }
};

export const initializeWalletBalances = async (principalId: string) => {
  if (!principalId || principalId === "anonymous") {
    console.log('No principal ID or anonymous user');
    walletBalancesStore.set({});
    currentWalletStore.set(null);
    return;
  }

  const currentWallet = get(currentWalletStore);
  if (currentWallet === principalId) {
    // Already initialized for this wallet
    const existingBalances = get(walletBalancesStore);
    if (Object.keys(existingBalances).length > 0) {
      return;
    }
  }

  try {
    // Get all tokens first
    const allTokens = await TokenService.fetchTokens();
    if (!allTokens?.length) {
      console.log('No tokens available');
      walletBalancesStore.set({});
      return;
    }

    // Get fresh balances for all tokens
    const balances = await TokenService.fetchBalances(allTokens, principalId, true);
    
    if (!balances || Object.keys(balances).length === 0) {
      console.log('No balances received from TokenService');
      walletBalancesStore.set({});
      return;
    }

    // Filter out zero balances and create entries
    const entries = Object.entries(balances)
      .filter(([_, balance]) => {
        const hasValidBalance = balance.in_tokens !== undefined && 
                              balance.in_usd !== undefined &&
                              balance.in_tokens > BigInt(0);
        return hasValidBalance;
      })
      .map(([canisterId, balance]) => ({
        wallet_id: principalId,
        canister_id: canisterId,
        in_tokens: balance.in_tokens,
        in_usd: balance.in_usd,
        timestamp: Date.now(),
      }));

    if (entries.length > 0) {      
      // Update the store with only non-zero balances
      const newBalances = entries.reduce((acc, entry) => {
        acc[entry.canister_id] = {
          in_tokens: entry.in_tokens,
          in_usd: entry.in_usd,
        };
        return acc;
      }, {} as Record<string, FE.TokenBalance>);
      
      // Update both stores
      currentWalletStore.set(principalId);
      walletBalancesStore.set(newBalances);
    } else {
      // If no non-zero balances found, set empty object
      walletBalancesStore.set({});
    }
  } catch (error) {
    console.error("Error initializing wallet balances:", error);
    walletBalancesStore.set({});
  }
};

export const loadWalletBalances = async (
  owner: string,
  opts?: { tokens?: FE.Token[]; forceRefresh?: boolean },
) => {
  if (!owner || owner === "anonymous") {
    console.log('No wallet ID or anonymous user');
    return {};
  }

  const { tokens, forceRefresh = false } = opts || { tokens: [] };
  if (!tokens || tokens.length === 0) {
    return {};
  }

  try {
    // Get fresh balances
    const balances = await TokenService.fetchBalances(
      tokens,
      owner,
      forceRefresh,
    );
    
    // Validate that we received actual balances
    if (!balances || Object.keys(balances).length === 0) {
      console.log('No balances received from TokenService');
      return {};
    }

    // Filter out zero balances and create entries
    const entries = Object.entries(balances)
      .filter(([_, balance]) => {
        const hasValidBalance = balance.in_tokens !== undefined && 
                              balance.in_usd !== undefined &&
                              balance.in_tokens > BigInt(0);
        return hasValidBalance;
      })
      .map(([canisterId, balance]) => ({
        wallet_id: owner,
        canister_id: canisterId,
        in_tokens: balance.in_tokens,
        in_usd: balance.in_usd,
        timestamp: Date.now(),
      }));

    if (entries.length > 0) {      
      // Update the store with only non-zero balances
      const newBalances = entries.reduce((acc, entry) => {
        acc[entry.canister_id] = {
          in_tokens: entry.in_tokens,
          in_usd: entry.in_usd,
        };
        return acc;
      }, {} as Record<string, FE.TokenBalance>);
      
      walletBalancesStore.set(newBalances);
    }

    return balances;
  } catch (error) {
    console.error("Error loading wallet balances:", error);
    return {};
  }
};
