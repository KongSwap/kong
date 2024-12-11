// src/kong_svelte/src/lib/features/tokens/tokenStore.ts
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
import { formatTokenAmount } from "$lib/utils/numberFormatUtils";
import { getHistoricalPrice } from "$lib/price/priceService";
import { CKUSDT_CANISTER_ID } from "$lib/constants/canisterConstants";

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

  const loadBalancesForTokens = async (tokens: FE.Token[], principal: Principal) => {
    if (!principal) {
      console.warn("No principal provided to loadBalancesForTokens");
      return {};
    }
    try {
      const balances = await TokenService.fetchBalances(tokens, principal.toString());
      store.update((s) => ({
        ...s,
        balances: {
          ...s.balances,
          ...balances
        },
      }));
      return balances;
    } catch (error) {
      console.error("Error loading balances:", error);
      toastStore.error("Failed to load balances");
      return {};
    }
  };

  eventBus.on('tokensFetched', async (fetchedTokens: FE.Token[]) => {
    try {
      // First try to get tokens with prices from kongDB
      const cachedTokens = await kongDB.tokens
        .where('timestamp')
        .above(Date.now() - TokenService.TOKEN_CACHE_DURATION)
        .toArray();

      const tokensWithPrices = await Promise.all(fetchedTokens.map(async token => {
        // Find cached token with price
        const cachedToken = cachedTokens.find(t => t.canister_id === token.canister_id);
        
        // Get historical price for 24h change
        const historicalPrice = await getHistoricalPrice(token);
        const currentPrice = Number(token.metrics?.price || 0);
        
        // Calculate price change
        const priceChange = historicalPrice > 0 ? 
          ((currentPrice - historicalPrice) / historicalPrice) * 100 : 
          0;

        return {
          ...token,
          metrics: {
            ...token.metrics,
            price_change_24h: priceChange.toFixed(2),
            historical_price: historicalPrice
          }
        };
      }));

      // Update store with initial tokens (with cached prices)
      store.update((s) => ({
        ...s,
        tokens: tokensWithPrices,
        lastTokensFetch: Date.now(),
        isLoading: false,
      }));

      const wallet = get(auth);
      const enrichedTokens = await TokenService.enrichTokenWithMetadata(tokensWithPrices);
      const validTokens = enrichedTokens
        .filter((result) => result.status === "fulfilled")
        .map((result) => (result as PromiseFulfilledResult<FE.Token>).value);

      // Only fetch new prices for tokens that don't have a recent cached price
      const tokensNeedingPrices = validTokens.filter(token => {
        const cachedToken = cachedTokens.find(t => t.canister_id === token.canister_id);
        const needsPrice = !cachedToken || (Date.now() - cachedToken.timestamp) > TokenService.TOKEN_CACHE_DURATION;
        return needsPrice;
      });

      let prices = {};
      if (tokensNeedingPrices.length > 0) {
        prices = await TokenService.fetchPrices(tokensNeedingPrices);
        console.log('Fetched new prices:', prices);
      }

      // Combine cached prices with newly fetched prices
      const allPrices = validTokens.reduce((acc, token) => {
        const cachedToken = cachedTokens.find(t => t.canister_id === token.canister_id);
        acc[token.canister_id] = prices[token.canister_id] || cachedToken?.price || 0;
        return acc;
      }, {} as Record<string, number>);
      
      // Then load balances if we have a wallet
      let balances = {};
      if(wallet.account && wallet.account.owner) {
        balances = await loadBalances(wallet.account.owner);
      }

      // Update everything at once to prevent multiple re-renders
      store.update((s) => ({
        ...s,
        tokens: validTokens,
        prices: allPrices,
        balances,
        isLoading: false,
      }));

    } catch (error: any) {
      console.error("Error enriching tokens:", error);
      store.update((s) => ({
        ...s,
        error: error.message,
        isLoading: false,
      }));
      toastStore.error("Failed to enrich tokens");
    }
  });

  // Add pool update handler with debounce to prevent rapid updates
  const debouncedPoolUpdate = debounce(async (pools: BE.Pool[]) => {
    const currentStore = get(store);
    const updatedTokens = currentStore.tokens.map(token => {
      const volume = pools
        .filter(p => p.address_0 === token.canister_id || p.address_1 === token.canister_id)
        .reduce((acc, p) => acc + (Number(p.rolling_24h_volume) / (10 ** 6)), 0);

      const updatedToken = {
        ...token,
        pools: pools.filter(p => p.address_0 === token.canister_id || p.address_1 === token.canister_id),
        metrics: {
          ...token.metrics,
          volume_24h: volume.toString()
        }
      };

      // Update the token in the database to persist volume
      kongDB.tokens.put({
        ...updatedToken,
        timestamp: Date.now()
      });

      return updatedToken;
    });

    // Update tokens and trigger a price refresh
    store.update(state => ({
      ...state,
      tokens: updatedTokens,
    }));

    // Refresh prices after pool update
    const prices = await TokenService.fetchPrices(updatedTokens);
    store.update(state => ({
      ...state,
      prices,
    }));
  }, 1000);

  eventBus.on('poolsUpdated', debouncedPoolUpdate);

  return {
    subscribe: store.subscribe,
    update: store.update,
    loadTokens: async (forceRefresh = false) => {
      store.update((s) => ({ ...s, isLoading: true }));
      try {
        const baseTokens = await TokenService.fetchTokens();
        if (!baseTokens || baseTokens.length === 0) {
          throw new Error('No tokens fetched from service');
        }

        eventBus.emit('tokensFetched', baseTokens);
        store.update((s) => ({
          ...s,
          isLoading: false,
          error: null,
          tokens: baseTokens,
          lastTokensFetch: Date.now()
        }));

        return baseTokens;
      } catch (error: any) {
        console.error("Error loading tokens:", error);
        store.update((s) => ({
          ...s,
          error: error.message,
          isLoading: false,
          tokens: s.tokens || [] // Keep existing tokens on error
        }));
        throw error;
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
    updateBalances: (newBalances: Record<string, { in_tokens: bigint; in_usd: string }>) => {
      store.update(state => {
        const updatedState = {
          ...state,
          balances: { ...newBalances }
        };
        return updatedState;
      });
    },
    updateTokenBalance: (tokenId: string, balance: { in_tokens: bigint; in_usd: string }) => {
      store.update(state => ({
        ...state,
        balances: {
          ...state.balances,
          [tokenId]: balance
        }
      }));
    },
    async updatePrices() {
      try {
        const currentStore = get(store);
        if (!currentStore?.tokens) return;

        const prices = await this.loadPrices();
        const balances = { ...currentStore.balances };
        const tokens = [...currentStore.tokens] as FE.Token[];
        const ckusdtToken = tokens.find(t => t.symbol === "ckUSDT");

        if (!ckusdtToken) {
          console.warn('ckUSDT token not found for price calculations');
          return;
        }

        // Update each token's price and get 24h changes
        for (const token of tokens) {
          const currentPrice = prices[token.canister_id] || 0;

          // Update token metrics
          token.metrics = {
            ...token.metrics,
            price: currentPrice,
          };

          // Update balance in USD if exists
          if (balances[token.canister_id]) {
            const balance = balances[token.canister_id].in_tokens;
            const amount = Number(formatTokenAmount(balance.toString(), token.decimals));
            balances[token.canister_id].in_usd = formatToNonZeroDecimal(amount * currentPrice);
          }
        }

        store.set({
          ...currentStore as TokenState,
          tokens,
          balances
        });

      } catch (error) {
        console.error('Error updating prices:', error);
      }
    },
  };
}

export const cleanup = () => {
};

export const tokenStore = createTokenStore();

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
    
    return ($liveTokens as FE.Token[])
      .map(token => {
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
        formattedBalance = formattedBalance.replace(/\.?0+$/, '');
        
        const usdValue = amount.times(price);
        const isFavorite = favorites.includes(token.canister_id);

        // Preserve all original token properties and add formatted ones
        return {
          ...token,
          logo_url: token.logo_url, // Explicitly preserve logo_url
          metrics: {
            ...token.metrics,
            price: price.toString(),
            market_cap: (Number(price) * (Number(token.metrics?.total_supply) / Math.pow(10, token.decimals))).toString(),
            price_change_24h: token.canister_id === CKUSDT_CANISTER_ID ? 0 : token.metrics.price_change_24h
          },
          balance: balance.toString(),
          formattedBalance,
          formattedUsdValue: formatToNonZeroDecimal(usdValue.toString()),
          total_24h_volume: token.metrics.volume_24h || "0",
          usdValue: Number(usdValue),
          isFavorite
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

export const portfolioValue = derived(
  [tokenStore, formattedTokens],
  ([$tokenStore, $formattedTokens]) => {
    if (!$formattedTokens) return "$0.00";

    const total = $formattedTokens.reduce((sum, token) => {
      const balance = $tokenStore.balances[token.canister_id]?.in_tokens || 0n;
      const price = $tokenStore.prices[token.canister_id] || 0;
      const amount = Number(balance) / Math.pow(10, token.decimals);
      return sum + (amount * price);
    }, 0);

    // Format with commas and 2 decimal places
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(total);
  }
);

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
