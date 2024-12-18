// src/kong_svelte/src/lib/features/tokens/tokenStore.ts
import { kongDB } from "$lib/services/db";
import { writable, derived, get, type Readable } from "svelte/store";
import BigNumber from "bignumber.js";
import { TokenService } from "./TokenService";
import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
import { toastStore } from "$lib/stores/toastStore";
import { auth } from "$lib/services/auth";
import { liveQuery, type Observable } from "dexie";
import { Principal } from "@dfinity/principal";
import { getHistoricalPrice } from "$lib/price/priceService";
import { browser } from "$app/environment";

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

interface TokenState {
  tokens: FE.Token[];
  balances: Record<string, FE.TokenBalance>;
  prices: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  totalValueUsd: string;
  lastTokensFetch: number | null;
  activeSwaps: Record<string, any>;
  favoriteTokens: Record<string, string[]>;
  lastBalanceUpdate: Record<string, number>;
  lastPriceUpdate: Record<string, number>;
  priceChangeClasses: Record<string, string>;
}

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
    lastPriceUpdate: {},
    priceChangeClasses: {}
  };
  const store = writable<TokenState>(initialState);

  const getCurrentWalletId = (): string => {
    const wallet = get(auth);
    return wallet?.account?.owner?.toString() || "anonymous";
  };

  const loadBalances = async (
    principal: Principal,
    forceRefresh: boolean = false,
  ) => {
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

  const loadBalancesForTokens = async (
    tokens: FE.Token[],
    principal: Principal,
  ) => {
    if (!principal) {
      console.warn("No principal provided to loadBalancesForTokens");
      return {};
    }
    try {
      const balances = await TokenService.fetchBalances(
        tokens,
        principal.toString(),
      );
      store.update((s) => ({
        ...s,
        balances: {
          ...s.balances,
          ...balances,
        },
      }));
      return balances;
    } catch (error) {
      console.error("Error loading balances:", error);
      toastStore.error("Failed to load balances");
      return {};
    }
  };



  return {
    subscribe: store.subscribe,
    update: store.update,
    loadTokens: async (forceRefresh = false) => {
      store.update((s) => ({ ...s, isLoading: true }));
      try {
        const baseTokens = await TokenService.fetchTokens();
        if (!baseTokens || baseTokens.length === 0) {
          throw new Error("No tokens fetched from service");
        }

        // Only update IndexedDB in the browser
        if (browser) {
          await Promise.all(
            baseTokens.map(async (token) => {
              await kongDB.tokens.put({
                ...token,
                timestamp: Date.now(),
                metrics: {
                  ...token.metrics,
                  price: token.metrics?.price || "0",
                  price_change_24h: token.metrics?.price_change_24h || "0",
                  volume_24h: token.metrics?.volume_24h || "0",
                  market_cap: token.metrics?.market_cap || "0",
                  total_supply: token.metrics?.total_supply || "0"
                }
              });
            })
          );
        }

        // Update store directly
        store.update((s) => ({
          ...s,
          isLoading: false,
          error: null,
          tokens: baseTokens,
          lastTokensFetch: Date.now(),
        }));

        // Load balances if we have a wallet
        const wallet = get(auth);
        if (browser && wallet.account && wallet.account.owner) {
          const balances = await loadBalances(wallet.account.owner);
          store.update((s) => ({
            ...s,
            balances,
          }));
        }

        return baseTokens;
      } catch (error: any) {
        console.error("Error loading tokens:", error);
        store.update((s) => ({
          ...s,
          error: error.message,
          isLoading: false,
          tokens: s.tokens || [], // Keep existing tokens on error
        }));
        throw error;
      }
    },
    loadBalances,
    loadBalancesForTokens,
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
      try {
        const wallet = get(auth);
        const walletId = wallet?.account?.owner?.toString() || "anonymous";
        const store = get(tokenStore);
        const currentFavorites = store?.favoriteTokens[walletId] || [];
        const isFavorite = currentFavorites.includes(canister_id);

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
    isFavorite: (canister_id: string | null | undefined): boolean => {
      if (!canister_id) return false;
      const currentState = get(store);
      const wallet = get(auth);
      const walletId = wallet?.account?.owner?.toString() || "anonymous";
      return currentState.favoriteTokens[walletId]?.includes(canister_id) ?? false;
    },
    getFavorites: (walletId: string = getCurrentWalletId()) => {
      const currentState = get(store);
      return currentState.favoriteTokens[walletId] || [];
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
        .equals(getCurrentWalletId())
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
    updateBalances: (
      newBalances: Record<string, { in_tokens: bigint; in_usd: string }>,
    ) => {
      store.update((state) => {
        const updatedState = {
          ...state,
          balances: { ...newBalances },
        };
        return updatedState;
      });
    },
    handlePriceUpdate: (updates: any[]) => {
      updateTokenMetrics(updates);
    },
  };
}

export const cleanup = () => {};
export const tokenStore = createTokenStore();

// Create a wrapper to convert Dexie Observable to Svelte Readable
function observableToReadable<T>(
  observable: Observable<T>,
): Readable<T | undefined> {
  return {
    subscribe: (run) => {
      const subscription = observable.subscribe({
        next: (value) => run(value),
        error: (error) => console.error("Observable error:", error),
      });
      return () => subscription.unsubscribe();
    },
  };
}

export const liveTokens = observableToReadable(
  liveQuery(async () => {
    try {
      // Only access IndexedDB in the browser
      if (!browser) {
        return [];
      }

      // First get cached tokens to show immediately
      const cachedTokens = await kongDB.tokens.toArray();

      // If we have cached tokens, return them immediately
      if (cachedTokens.length > 0) {
        return cachedTokens;
      }

      // If no cached tokens, get from store
      const store = get(tokenStore);
      if (store.tokens.length > 0) {
        await Promise.all(
          store.tokens.map((token) =>
            kongDB.tokens.put({
              ...token,
              timestamp: Date.now(),
            }),
          ),
        );
        return store.tokens;
      }

      return [];
    } catch (error) {
      console.error("Error in liveQuery:", error);
      return [];
    }
  }),
);

export const formattedTokens = derived<
  [typeof tokenStore, Readable<FE.Token[] | undefined>],
  FE.Token[]
>([tokenStore, liveTokens], ([$tokenStore, $liveTokens]) => {
  if (!$liveTokens) return [];

  const wallet = get(auth);
  const walletId = wallet?.account?.owner?.toString() || "anonymous";
  const favorites = $tokenStore?.favoriteTokens[walletId] || [];

  return ($liveTokens as FE.Token[])
    .map((token) => {
      const balance = $tokenStore.balances[token.canister_id]?.in_tokens || BigInt(0);
      const amount = toTokenDecimals(balance.toString(), token.decimals);
      const price = $tokenStore.prices[token.canister_id] || 0;

      // Format balance with appropriate decimals based on value
      let formattedBalance;
      const numericAmount = Number(amount);
      if (numericAmount === 0) {
        formattedBalance = "0";
      } else if (numericAmount < 0.000001) {
        formattedBalance = amount.toFormat(8);
      } else if (numericAmount < 0.01) {
        formattedBalance = amount.toFormat(6);
      } else {
        formattedBalance = amount.toFormat(4);
      }

      // Remove trailing zeros
      formattedBalance = formattedBalance.replace(/\.?0+$/, "");

      // Preserve all original token properties and add formatted ones
      return {
        ...token,
        balance: balance.toString(),
        formattedBalance,
        formattedUsdValue: formatToNonZeroDecimal(
          amount.times(price).toString(),
        ),
        total_24h_volume: token.metrics.volume_24h || "0",
        isFavorite: favorites.includes(token.canister_id),
      } as FE.Token;
    })
    .sort((a, b) => {
      // Sort by favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      // Then sort by 24h trading volume
      const aVolume = Number(a.metrics.volume_24h || 0);
      const bVolume = Number(b.metrics.volume_24h || 0);
      return bVolume - aVolume;
    });
});

export const favoriteTokens = derived(tokenStore, ($store) => {
  const wallet = get(auth);

  if (!$store || !wallet) return [];

  const walletId = wallet.account?.owner?.toString() || "anonymous";
  return (
    $store?.tokens?.filter((token) =>
      $store.favoriteTokens[walletId]?.includes(token.canister_id),
    ) ?? []
  );
});

export const portfolioValue = derived<
  [typeof tokenStore, Readable<FE.Token[]>],
  string
>([tokenStore, formattedTokens], ([$tokenStore, $formattedTokens]) => {
  if (!$formattedTokens) return "$0.00";

  const total = ($formattedTokens as FE.Token[]).reduce((sum, token) => {
    const balance = $tokenStore.balances[token.canister_id]?.in_tokens || 0n;
    const price = $tokenStore.prices[token.canister_id] || 0;
    const amount = Number(balance) / Math.pow(10, token.decimals);
    return sum + amount * price;
  }, 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(total);
});

export const tokenPrices = derived(
  tokenStore,
  ($store) => $store?.prices ?? {},
);

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

export function updateTokenMetrics(updates: Array<{
  id: string;
  price: number;
  previousPrice: number;
  price_change_24h: number;
  volume?: number;
  market_cap?: string;
}>) {
  console.log('Processing token metrics update:', updates);
  
  tokenStore.update(store => {
    const newPriceChangeClasses = { ...store.priceChangeClasses };
    
    const updatedTokens = store.tokens.map(token => {
      const update = updates.find(u => u.id === token.canister_id);
      if (update) {
        // Only trigger animation if price change is significant
        const priceDiff = Math.abs(update.price - update.previousPrice);
        if (priceDiff > 0.000001) {
          console.log(`Applying price change animation for ${token.symbol}:`, {
            previous: update.previousPrice,
            new: update.price,
            diff: priceDiff
          });
          
          newPriceChangeClasses[token.canister_id] = 
            update.price > update.previousPrice ? 'flash-green' : 'flash-red';
            
          // Schedule removal of animation class
          setTimeout(() => {
            console.log(`Removing animation class for ${token.symbol}`);
            tokenStore.update(s => ({
              ...s,
              priceChangeClasses: {
                ...s.priceChangeClasses,
                [token.canister_id]: ''
              }
            }));
          }, 1000);
        }

        return {
          ...token,
          metrics: {
            ...token.metrics,
            price: update.price.toString(),
            price_change_24h: update.price_change_24h.toString(),
            volume_24h: update.volume?.toString() || token.metrics?.volume_24h,
            market_cap: update.market_cap || token.metrics?.market_cap
          }
        };
      }
      return token;
    });

    const newState = {
      ...store,
      tokens: updatedTokens,
      prices: {
        ...store.prices,
        ...Object.fromEntries(updates.map(u => [u.id, u.price]))
      },
      priceChangeClasses: newPriceChangeClasses
    };

    console.log('Updated store state:', {
      priceChangeClasses: newPriceChangeClasses,
      prices: Object.fromEntries(updates.map(u => [u.id, u.price]))
    });

    return newState;
  });
}

export function handlePriceUpdate(updates: any[]) {
  updateTokenMetrics(updates);
}

export const isValidToken = (token: any): token is FE.Token => {
  return (
    token &&
    typeof token === 'object' &&
    typeof token.canister_id === 'string' &&
    typeof token.symbol === 'string' &&
    typeof token.name === 'string'
  );
};
