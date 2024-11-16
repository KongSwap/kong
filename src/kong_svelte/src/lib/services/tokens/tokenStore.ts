// src/kong_svelte/src/lib/features/tokens/tokenStore.ts
import type { TokenState } from "./types";
import { kongDB } from "$lib/services/db";
import { writable, derived, get, type Readable } from "svelte/store";
import BigNumber from "bignumber.js";
import { TokenService } from "./TokenService";
import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
import { toastStore } from "$lib/stores/toastStore";
import { eventBus } from './eventBus';
import { walletStore } from "$lib/services/wallet/walletStore";

BigNumber.config({
  DECIMAL_PLACES: 36,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: [-50, 50],
});

// Helper functions to handle token-specific decimal precision
const toTokenDecimals = (
  amount: BigNumber | string | number,
  decimals: number,
): BigNumber => {
  return new BigNumber(amount).dividedBy(new BigNumber(10 ** decimals));
};

export const fromTokenDecimals = (
  amount: BigNumber | string | number,
  decimals: number,
): BigNumber => {
  return new BigNumber(amount).multipliedBy(new BigNumber(10 ** decimals));
};

// Modify the debounce utility to preserve the return type
const debounce = <T extends (...args: any[]) => any>(fn: T, ms = 300): T => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>): ReturnType<T> => {
    clearTimeout(timeoutId);
    return new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(fn(...args)), ms);
    }) as ReturnType<T>;
  }) as T;
};

const DEBUG = true;

function createTokenStore() {
  const initialState: TokenState = {
    tokens: [],
    balances: {},
    prices: {},
    isLoading: false,
    error: null,
    totalValueUsd: "0.00",
    lastTokensFetch: null,
    activeSwaps: {},
    favoriteTokens: {},
  };

  const store = writable<TokenState>(initialState);
  const getCurrentWalletId = (): string => {
    let walletId = '';
    const unsubscribe = walletStore.subscribe(($wallet) => {
      walletId = $wallet?.account?.owner?.toString() || "anonymous";
    });
    unsubscribe();
    return walletId;
  };

  const loadBalances = async () => {
    const currentStore = get(store);
    const walletId = getCurrentWalletId();
    if (!walletId) return {};
    try {
      const balances = await TokenService.fetchBalances(
        currentStore.tokens,
        walletId,
      );
      const prices = await TokenService.fetchPrices(currentStore.tokens);

      store.update((s) => ({
        ...s,
        balances,
        prices,
      }));
      return balances;
    } catch (error) {
      console.error("Error loading balances:", error);
      toastStore.error("Failed to load balances");
      return {};
    }
  };

  eventBus.on('tokensFetched', async (fetchedTokens: FE.Token[]) => {
    store.update((s) => ({
      ...s,
      tokens: fetchedTokens,
      lastTokensFetch: Date.now(),
      isLoading: false,
    }));

    try {
      const enrichedTokens = await TokenService.enrichTokenWithMetadata(fetchedTokens);
      const validTokens = enrichedTokens
        .filter((result) => result.status === "fulfilled")
        .map((result) => (result as PromiseFulfilledResult<FE.Token>).value);

      store.update((s) => ({
        ...s,
        tokens: validTokens,
      }));

      const balances = await loadBalances();
      store.update((s) => ({
        ...s,
        balances,
      }));
    } catch (error: any) {
      console.error("Error enriching tokens:", error);
      store.update((s) => ({
        ...s,
        error: error.message,
        tokens: [],
      }));
      toastStore.error("Failed to enrich tokens");
    }
  });

  eventBus.on('tokensUpdated', async (updatedTokens: FE.Token[]) => {
    store.update((s) => ({
      ...s,
      tokens: updatedTokens,
    }));
    await loadBalances();
  });

  return {
    subscribe: store.subscribe,
    update: store.update,
    loadTokens: async (forceRefresh = false) => {
      store.update((s) => ({ ...s, isLoading: true }));
      try {
        const baseTokens = await TokenService.fetchTokens();

        eventBus.emit('tokensFetched', baseTokens);

        return baseTokens;
      } catch (error: any) {
        console.error("Error loading tokens:", error);
        store.update((s) => ({
          ...s,
          error: error.message,
          isLoading: false,
          tokens: [],
        }));
        toastStore.error("Failed to load tokens");
        return [];
      }
    },
    loadBalances,
    loadBalance: debounce(
      async (
        token: FE.Token,
        principalId?: string,
        forceRefresh = false,
      ): Promise<FE.TokenBalance> => {
        let balance: FE.TokenBalance;
        if (!token?.canister_id) {
          return (balance = {
            in_tokens: BigInt(0),
            in_usd: formatToNonZeroDecimal(0),
          });
        } else {
          balance = await TokenService.fetchBalance(
            token,
            principalId,
            forceRefresh,
          );
        }
        store.update((s) => ({
          ...s,
          balances: {
            ...s.balances,
            [token.canister_id]: balance,
          },
        }));
        return {
          in_tokens: balance.in_tokens || BigInt(0),
          in_usd: balance.in_usd || "0",
        };
      },
    ),
    loadPrices: async () => {
      const currentStore = get(store);
      try {
        const [prices, updatedTokens] = await Promise.all([
          TokenService.fetchPrices(currentStore.tokens),
          TokenService.fetchTokens()
        ]);

        // Enrich tokens with volume data
        const enrichedTokens = await TokenService.enrichTokenWithMetadata(updatedTokens);
        const validTokens = enrichedTokens
          .filter((result) => result.status === "fulfilled")
          .map((result) => (result as PromiseFulfilledResult<FE.Token>).value);

        eventBus.emit('tokensUpdated', validTokens);

        store.update((s) => ({
          ...s,
          prices,
          tokens: validTokens,  // Use the enriched tokens with updated volume
        }));
      } catch (error) {
        console.error("Error loading prices and volumes:", error);
      }
    },
    getToken: (canister_id: string): FE.Token | null => {
      return (
        get(store).tokens.find((token) => token.canister_id === canister_id) ||
        null
      );
    },
    refetchPrice: async (token: FE.Token): Promise<number> => {
      const price = await TokenService.fetchPrice(token);
      store.update((s) => ({
        ...s,
        prices: { ...s.prices, [token.canister_id]: price },
      }));
      return price;
    },
    clearUserData: async () => {
      const walletId = getCurrentWalletId();

      await kongDB.favorite_tokens.where("wallet_id").equals(walletId).delete();

      await kongDB.tokens
        .where("timestamp")
        .below(Date.now() + 1000 * 60 * 60 * 24)
        .delete();

      await kongDB.images
        .where("timestamp")
        .below(Date.now() + 1000 * 60 * 60 * 24)
        .delete();

      store.update((s) => ({
        ...s,
        balances: {},
        isLoading: false,
        error: null,
        totalValueUsd: "0.00",
        activeSwaps: {},
        favoriteTokens: {
          ...s.favoriteTokens,
          [walletId]: [],
        },
      }));
    },

    clearCache: async () => {
      await kongDB.tokens.clear();
      await kongDB.favorite_tokens
        .where("wallet_id")
        .equals(getCurrentWalletId())
        .delete();
      store.set(initialState);
    },
    loadFavorites: async () => {
      const walletId = getCurrentWalletId();
      const favorites = await kongDB.favorite_tokens
        .where("wallet_id")
        .equals(walletId)
        .toArray();
      store.update((s) => ({
        ...s,
        favoriteTokens: {
          [walletId]: favorites.map((f) => f.canister_id),
        },
      }));
      return favorites.map((f) => f.canister_id);
    },
    toggleFavorite: async (canister_id: string) => {
      const walletId = getCurrentWalletId();
      if (!walletId) {
        console.warn("Cannot toggle favorite: No wallet connected");
        return;
      }

      const currentState = get(store);
      const currentFavorites = currentState.favoriteTokens[walletId] || [];
      const isFavorite = currentFavorites.includes(canister_id);

      console.log("Toggling favorite:", {
        canister_id,
        walletId,
        currentFavorites,
        isFavorite,
      });

      if (isFavorite) {
        await removeFavoriteToken(canister_id, walletId);
        store.update((s) => ({
          ...s,
          favoriteTokens: {
            ...s.favoriteTokens,
            [walletId]: currentFavorites.filter((id) => id !== canister_id),
          },
        }));
      } else {
        await saveFavoriteToken(canister_id, walletId);
        store.update((s) => ({
          ...s,
          favoriteTokens: {
            ...s.favoriteTokens,
            [walletId]: [...currentFavorites, canister_id],
          },
        }));
      }

      console.log("Store state after toggle:", get(store).favoriteTokens);
    },
    isFavorite: (canister_id: string): boolean => {
      const currentState = get(store);
      const walletId = getCurrentWalletId();
      return (
        currentState.favoriteTokens[walletId]?.includes(canister_id) ?? false
      );
    },
    getFavorites: (walletId: string = getCurrentWalletId()) => {
      const currentState = get(store);
      return currentState.favoriteTokens[walletId] || [];
    },
    claimFaucetTokens: async () => {
      await TokenService.claimFaucetTokens();
      await loadBalances();
    },
  };
}

export const tokenStore: {
  subscribe: (run: (value: TokenState) => void) => () => void;
  update: (updater: (state: TokenState) => TokenState) => void;
  loadTokens: (forceRefresh?: boolean) => Promise<FE.Token[]>;
  loadBalances: () => Promise<Record<string, FE.TokenBalance>>;
  loadBalance: (
    token: FE.Token,
    principalId?: string,
    forceRefresh?: boolean,
  ) => Promise<FE.TokenBalance>;
  loadPrices: () => Promise<void>;
  refetchPrice: (token: FE.Token) => Promise<number>;
  clearUserData: () => void;
  clearCache: () => Promise<void>;
  loadFavorites: () => Promise<string[]>;
  toggleFavorite: (canister_id: string) => void;
  isFavorite: (canister_id: string) => boolean;
  getFavorites: (walletId?: string) => string[];
  getToken: (canister_id: string) => FE.Token | null;
  claimFaucetTokens: () => Promise<void>;
} = createTokenStore();

export const favoriteTokens = derived(
  tokenStore,
  ($store) => {
    const wallet = get(walletStore);
    console.log("Derived favoriteTokens - tokenStore:", $store);
    console.log("Derived favoriteTokens - walletStore:", wallet);
    if (!$store || !wallet) return [];
    const walletId = wallet.account?.owner?.toString() || "anonymous";
    return (
      $store?.tokens?.filter((token) =>
        $store.favoriteTokens[walletId]?.includes(token.canister_id),
      ) ?? []
    );
  }
);

export const portfolioValue = derived(tokenStore, ($store) => {
  console.log("Derived portfolioValue - tokenStore:", $store);
  if (!$store?.tokens) return "0.00";
  let totalValue = 0;

  for (const token of $store.tokens) {
    const usdValue = parseFloat(
      $store.balances[token.canister_id]?.in_usd || "0",
    );
    totalValue += usdValue;
  }

  return formatToNonZeroDecimal(totalValue);
});

export const formattedTokens: Readable<FE.Token[]> = derived(
  tokenStore,
  ($tokenStore) => {
    const wallet = get(walletStore);
    if (!$tokenStore || !wallet) {
      console.error("One or more stores are not initialized.");
      return [];
    }

    if (!$tokenStore.tokens) return [];

    const walletId = wallet.account?.owner?.toString() || "anonymous";

    return $tokenStore.tokens
      .map((token) => {
        const balance =
          $tokenStore.balances[token.canister_id]?.in_tokens || BigInt(0);
        const amount = toTokenDecimals(balance.toString(), token.decimals);
        const price = $tokenStore.prices[token.canister_id] || 0;

        const formattedBalance = amount.toFormat(token.decimals);
        const usdValue = amount.times(price);

        return {
          ...token,
          formattedBalance,
          formattedUsdValue: usdValue.toFormat(2),
          price,
          total_24h_volume: token.total_24h_volume || 0n,
        };
      })
      .sort((a, b) => {
        const aFavorite =
          $tokenStore.favoriteTokens[walletId]?.includes(a.canister_id) ?? false;
        const bFavorite =
          $tokenStore.favoriteTokens[walletId]?.includes(b.canister_id) ?? false;

        if (aFavorite && !bFavorite) return -1;
        if (!aFavorite && bFavorite) return 1;

        const aValue = parseFloat(a.formattedUsdValue.replace(/[^0-9.-]+/g, ""));
        const bValue = parseFloat(b.formattedUsdValue.replace(/[^0-9.-]+/g, ""));
        return bValue - aValue;
      });
  }
);

export const tokenPrices = derived(tokenStore, ($store) => $store?.prices ?? {});

export const toggleFavoriteToken = (canister_id: string): void => {
  tokenStore.toggleFavorite(canister_id);
};

export const isTokenFavorite = (canister_id: string): boolean => {
  const state = get(tokenStore);
  const wallet = get(walletStore);
  const walletId = wallet?.account?.owner?.toString();
  return state.favoriteTokens[walletId]?.includes(canister_id) ?? false;
};

export const getFavoritesForWallet = derived(tokenStore, ($store) => {
  const wallet = get(walletStore);
  const walletId = wallet?.account?.owner?.toString() || "anonymous";
  return $store?.favoriteTokens[walletId] || [];
});

async function saveFavoriteToken(canister_id: string, walletId: string) {
  try {
    const existing = await kongDB.favorite_tokens
      .where(["canister_id", "wallet_id"])
      .equals([canister_id, walletId])
      .first();

    if (!existing) {
      await kongDB.favorite_tokens.add({
        canister_id: canister_id,
        wallet_id: walletId,
        timestamp: Date.now(),
      });
    } else {
      await kongDB.favorite_tokens
        .where(["canister_id", "wallet_id"])
        .equals([canister_id, walletId])
        .modify({ timestamp: Date.now() });
    }
  } catch (error) {
    console.error("Error saving favorite token:", error);
  }
}

async function removeFavoriteToken(canister_id: string, walletId: string) {
  try {
    await kongDB.favorite_tokens
      .where(["canister_id", "wallet_id"])
      .equals([canister_id, walletId])
      .delete();
  } catch (error) {
    console.error("Error removing favorite token:", error);
  }
}

export const getTokenDecimals = (canister_id: string): number => {
  const token = tokenStore.getToken(canister_id);
  return token?.decimals || 0;
};
