// src/kong_svelte/src/lib/features/tokens/tokenStore.ts
import type { TokenState } from "./types";
import { kongDB } from "$lib/services/db";
import { writable, derived, get, type Readable } from "svelte/store";
import BigNumber from "bignumber.js";
import { TokenService } from "./TokenService";
import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
import { toastStore } from "$lib/stores/toastStore";
import { eventBus } from './eventBus';
import { auth } from "$lib/services/auth";
import { liveQuery } from "dexie";
import { Principal } from "@dfinity/principal";
import { AnonymousIdentity } from "@dfinity/agent";
import { poolStore } from "$lib/services/pools/poolStore";
import { formatTokenAmount } from "$lib/utils/numberFormatUtils";

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
    lastBalanceUpdate: {},
  };

  const store = writable<TokenState>(initialState);
  
  // Remove periodic balance updates setup since it's now handled by the worker

  const getCurrentWalletId = (): Principal => {
    let walletId;
    const wallet = get(auth);
    if (wallet && wallet.account && wallet.account.owner) {
      walletId = wallet.account.owner;
    } else {
      walletId = new AnonymousIdentity().getPrincipal();
    }
    return walletId;
  };

  const loadBalances = async (principal: Principal) => {
    const currentStore = get(store);
    if (!principal) {
      console.warn("No principal provided to loadBalances");
      return {};
    }
    const walletId = principal.toString();
    if (!walletId) return {};
    try {
      const balances = await TokenService.fetchBalances(
        currentStore.tokens,
        walletId,
      );
      store.update((s) => ({
        ...s,
        balances,
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
      const wallet = get(auth);
      const enrichedTokens = await TokenService.enrichTokenWithMetadata(fetchedTokens);
      const validTokens = enrichedTokens
        .filter((result) => result.status === "fulfilled")
        .map((result) => (result as PromiseFulfilledResult<FE.Token>).value);

      store.update((s) => ({
        ...s,
        tokens: validTokens,
      }));
      if(wallet.account && wallet.account.owner) {
        const balances = await loadBalances(wallet.account.owner);
        
        store.update((s) => ({
          ...s,
          balances,
        }));
      }
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
    loadPrices: async () => {
      try {
        const currentStore = get(store);
        if (!currentStore.tokens) return;

        const prices = await TokenService.fetchPrices(currentStore.tokens);
        store.update((s) => ({
          ...s,
          prices,
        }));

        // After prices are loaded, update USD values in balances
        const balances = { ...currentStore.balances };
        for (const token of currentStore.tokens) {
          if (balances[token.canister_id]) {
            const price = prices[token.canister_id] || 0;
            const amount = parseFloat(formatTokenAmount(balances[token.canister_id].in_tokens.toString(), token.decimals));
            balances[token.canister_id].in_usd = formatToNonZeroDecimal(amount * price);
          }
        }

        store.update((s) => ({
          ...s,
          balances,
        }));

        return prices;
      } catch (error) {
        console.error("Error loading prices:", error);
        toastStore.error("Failed to load prices");
      }
    },
    loadPrice: async (token: FE.Token): Promise<number> => {
      const price = await TokenService.fetchPrice(token);
      store.update((s) => ({
        ...s,
        prices: { ...s.prices, [token.canister_id]: price },
      }));
      return price;
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
          lastBalanceUpdate: {
            ...s.lastBalanceUpdate,
            [token.canister_id]: Date.now(),
          },
        }));
        return {
          in_tokens: balance.in_tokens || BigInt(0),
          in_usd: balance.in_usd || "0",
        };
      },
    ),
    loadFavorites: async () => {
      const walletId = getCurrentWalletId().toString();
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
      try {
        const wallet = get(auth);
        const walletId = wallet?.account?.owner?.toString() || "anonymous";
        const store = get(tokenStore);
        const currentFavorites = store?.favoriteTokens[walletId] || [];
        const isFavorite = currentFavorites.includes(canister_id);

        eventBus.emit("favorite-token-update", {
          canister_id,
          currentFavorites,
          isFavorite,
        });

        if (isFavorite) {
          await kongDB.favorite_tokens
            .where(["canister_id", "wallet_id"])
            .equals([canister_id, walletId])
            .delete();
          tokenStore.update((s) => ({
            ...s,
            favoriteTokens: {
              ...s.favoriteTokens,
              [walletId]: currentFavorites.filter((id) => id !== canister_id),
            },
          }));
        } else {
          await kongDB.favorite_tokens.add({
            canister_id,
            wallet_id: walletId,
            timestamp: Date.now(),
          });
          tokenStore.update((s) => ({
            ...s,
            favoriteTokens: {
              ...s.favoriteTokens,
              [walletId]: [...currentFavorites, canister_id],
            },
          }));
        }
      } catch (error) {
        console.error("Error toggling favorite token:", error);
        toastStore.error("Failed to update favorite token");
      }
    },
    isFavorite: (canister_id: string): boolean => {
      const currentState = get(store);
      const walletId = getCurrentWalletId().toString(); 
      return (
        currentState.favoriteTokens[walletId]?.includes(canister_id) ?? false
      );
    },
    getFavorites: (walletId: string = getCurrentWalletId().toString()) => {
      const currentState = get(store);
      return currentState.favoriteTokens[walletId] || [];
    },
    claimFaucetTokens: async () => {
      await TokenService.claimFaucetTokens();
      const pnp = get(auth);
      await loadBalances(pnp?.account?.owner);
    },
    clearUserData: () => {
      store.update((s) => ({
        ...initialState,
        tokens: s.tokens,
      }));
    },
    clearCache: async () => {
      await kongDB.tokens.clear();
      await kongDB.favorite_tokens
        .where("wallet_id")
        .equals(getCurrentWalletId().toString())  
        .delete();
      store.set(initialState);
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
    cleanup: async () => {
      // Cleanup any active subscriptions or connections
      store.set(initialState);
    },
  };
}

export const cleanup = () => {
};

export const tokenStore: {
  subscribe: (run: (value: TokenState) => void) => () => void;
  update: (updater: (state: TokenState) => TokenState) => void;
  loadTokens: (forceRefresh?: boolean) => Promise<FE.Token[]>;
  loadBalances: (principal: Principal) => Promise<Record<string, FE.TokenBalance>>;
  loadBalance: (
    token: FE.Token,
    principalId?: string,
    forceRefresh?: boolean,
  ) => Promise<FE.TokenBalance>;
  loadPrices: () => Promise<Record<string, number>>;
  loadPrice: (token: FE.Token) => Promise<number>;
  refetchPrice: (token: FE.Token) => Promise<number>;
  clearUserData: () => void;
  clearCache: () => Promise<void>;
  loadFavorites: () => Promise<string[]>;
  toggleFavorite: (canister_id: string) => void;
  isFavorite: (canister_id: string) => boolean;
  getFavorites: (walletId?: string) => string[];
  getToken: (canister_id: string) => FE.Token | null;
  claimFaucetTokens: () => Promise<void>;
  cleanup: () => Promise<void>;
} = createTokenStore();

const liveTokensQuery = liveQuery(async () => {
  return await kongDB.tokens.toArray();
});

export const liveTokens: Readable<FE.Token[] | undefined> = {
  subscribe: (run: (value: FE.Token[] | undefined) => void) => {
    const subscription = liveTokensQuery?.subscribe(run);
    return () => subscription?.unsubscribe();
  }
};

export const formattedTokens = derived(
  [tokenStore, liveTokens],
  ([$tokenStore, $liveTokens]) => {
    if (!$liveTokens) return [];
    
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString() || "anonymous";
    const favorites = $tokenStore?.favoriteTokens[walletId] || [];
    
    return $liveTokens
      .map(token => {
        const balance = $tokenStore.balances[token.canister_id]?.in_tokens || BigInt(0);
        const amount = toTokenDecimals(balance.toString(), token.decimals);
        const price = $tokenStore.prices[token.canister_id] || 0;
        const formattedBalance = amount.toFormat(token.decimals);
        const usdValue = amount.times(price);
        const isFavorite = favorites.includes(token.canister_id);

        return {
          ...token,
          balance: balance.toString(),
          formattedBalance,
          price,
          formattedUsdValue: formatToNonZeroDecimal(usdValue.toString()),
          total_24h_volume: token.total_24h_volume || 0n,
          usdValue: Number(usdValue),
          isFavorite
        };
      })
      .sort((a, b) => {
        // Sort by favorites first
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        
        // Then sort by USD value
        return b.usdValue - a.usdValue;
      });
  }
);

export const favoriteTokens = derived(
  tokenStore,
  ($store) => {
    const wallet = get(auth);

    if (!$store || !wallet) return [];

    const walletId = wallet.account?.owner?.toString() || "anonymous";
    return (
      $store?.tokens?.filter((token) =>
        $store.favoriteTokens[walletId]?.includes(token.canister_id),
      ) ?? []
    );
  }
);

export const portfolioValue = derived([tokenStore, poolStore], ([$tokenStore, $poolStore]) => {
  if (!$tokenStore?.tokens || !$poolStore?.pools) return "0.00";
  let totalValue = 0.0;

  for (const token of $tokenStore.tokens) {
    const usdValue = Number(
      $tokenStore?.balances[token.canister_id]?.in_usd?.replace(/,/g, '') || "0",
    );
    totalValue += usdValue;
  }
  return totalValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
});

export const tokenPrices = derived(tokenStore, ($store) => $store?.prices ?? {});

export const toggleFavoriteToken = async (canister_id: string) => {
  try {
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString() || "anonymous";
    const currentState = get(tokenStore);
    const currentFavorites = currentState?.favoriteTokens[walletId] || [];
    const isFavorite = currentFavorites.includes(canister_id);

    eventBus.emit("favorite-token-update", {
      canister_id,
      currentFavorites,
      isFavorite,
    });

    if (isFavorite) {
      await kongDB.favorite_tokens
        .where(["canister_id", "wallet_id"])
        .equals([canister_id, walletId])
        .delete();
      tokenStore.update((s) => ({
        ...s,
        favoriteTokens: {
          ...s.favoriteTokens,
          [walletId]: currentFavorites.filter((id) => id !== canister_id),
        },
      }));
    } else {
      await kongDB.favorite_tokens.add({
        canister_id,
        wallet_id: walletId,
        timestamp: Date.now(),
      });
      tokenStore.update((s) => ({
        ...s,
        favoriteTokens: {
          ...s.favoriteTokens,
          [walletId]: [...currentFavorites, canister_id],
        },
      }));
    }
  } catch (error) {
    console.error("Error toggling favorite token:", error);
    toastStore.error("Failed to update favorite token");
  }
};

export const isTokenFavorite = (canister_id: string): boolean => {
  const state = get(tokenStore);
  const wallet = get(auth);
  const walletId = wallet?.account?.owner?.toString();
  return state.favoriteTokens[walletId]?.includes(canister_id) ?? false;
};

export const getFavoritesForWallet = derived(tokenStore, ($store) => {
  const wallet = get(auth);
  const walletId = wallet?.account?.owner?.toString() || "anonymous";
  return $store?.favoriteTokens[walletId] || [];
});

export const getTokenDecimals = (canister_id: string): number => {
  const token = tokenStore.getToken(canister_id);
  return token?.decimals || 0;
};
