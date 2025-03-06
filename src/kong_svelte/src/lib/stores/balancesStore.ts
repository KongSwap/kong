import { writable, get } from "svelte/store";

// Create a store for balances
export const currentUserBalancesStore = writable<Record<string, FE.TokenBalance>>({});

// Helper function to get stored balances
export const getStoredBalances = async (walletId: string) => {
  if (!walletId || walletId === "anonymous") {
    return {};
  }

  try {
    const storedBalances = get(currentUserBalancesStore);

    return Object.entries(storedBalances).reduce(
      (acc, [canisterId, balance]) => {
        acc[canisterId] = {
          in_tokens: balance.in_tokens,
          in_usd: balance.in_usd,
        };
        return acc;
      },
      {} as Record<string, FE.TokenBalance>,
    );
  } catch (error) {
    console.error("Error getting stored balances:", error);
    return {};
  }
};

// Update stored balances
export const updateStoredBalances = async (walletId: string) => {
  const balances = await getStoredBalances(walletId);
  currentUserBalancesStore.set(balances);
};

// Helper function to update balances in the store
export const updateBalancesInStore = (entries: Array<{
  canister_id: string;
  in_tokens: bigint;
  in_usd: string;
}>) => {
  if (entries.length > 0) {
    const newBalances = { ...get(currentUserBalancesStore) };
    entries.forEach(entry => {
      newBalances[entry.canister_id] = {
        in_tokens: entry.in_tokens,
        in_usd: entry.in_usd,
      };
    });
    
    currentUserBalancesStore.set(newBalances);
  }
}; 