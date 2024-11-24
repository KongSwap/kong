import { auth } from "$lib/services/auth";
import { PoolService } from "../../services/pools/PoolService";
import {
  formatToNonZeroDecimal,
  formatTokenAmount,
} from "$lib/utils/numberFormatUtils";
import { get } from "svelte/store";
import { ICP_CANISTER_ID } from "$lib/constants/canisterConstants";
import { poolStore } from "$lib/services/pools/poolStore";
import { Principal } from "@dfinity/principal";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { parseTokens } from "./tokenParsers";
import {
  saveTokenLogo,
  getTokenLogo,
  fetchTokenLogo,
  DEFAULT_LOGOS,
} from "./tokenLogos";
import { kongDB } from "../db";
import { tokenStore } from "./tokenStore";
import { canisterId as kongBackendCanisterId } from "../../../../../declarations/kong_backend";
import { canisterIDLs } from "../pnp/PnpInitializer";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";

export class TokenService {
  protected static instance: TokenService;
  private static priceCache = new Map<
    string,
    { price: number; timestamp: number }
  >();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static readonly TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  public static async fetchTokens(): Promise<FE.Token[]> {
    try {
      // Try to get cached tokens first
      const cachedTokens = await kongDB.tokens
        .where('timestamp')
        .above(Date.now() - this.TOKEN_CACHE_DURATION)
        .toArray();

      if (cachedTokens.length > 0) {
        console.log('Using cached tokens');
        // Refresh in background after returning cached data
        setTimeout(() => this.fetchFromNetwork(), 0);
        return cachedTokens;
      }

      return await this.fetchFromNetwork();
    } catch (error) {
      console.error("Error fetching tokens:", error);
      return [];
    }
  }

  private static async fetchFromNetwork(): Promise<FE.Token[]> {
    let retries = 3;
    let actor;

    while (retries > 0) {
      try {
        actor = await createAnonymousActorHelper(kongBackendCanisterId, canisterIDLs.kong_backend);
        const result = await actor.tokens(["all"]);
        const parsed = parseTokens(result);

        if (parsed.Err) {
          console.error('Error parsing tokens:', parsed.Err);
          throw parsed.Err;
        }

        // Cache the tokens
        await Promise.all(
          parsed.Ok.map((token) =>
            kongDB.tokens.put({
              ...token,
              timestamp: Date.now(),
            })
          )
        );

        return parsed.Ok;
      } catch (error) {
        console.warn(`Token fetch attempt failed, ${retries - 1} retries left:`, error);
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return [];
  }

  private static async cacheTokens(tokens: FE.Token[]): Promise<void> {
    try {
      await kongDB.transaction("rw", kongDB.tokens, async () => {
        // Clear old cache
        await kongDB.tokens.clear();

        // Add new tokens with timestamp
        const timestamp = Date.now();
        const cachedTokens: FE.Token[] = tokens.map((token) => ({
          ...token,
          timestamp,
        }));

        await kongDB.tokens.bulkAdd(cachedTokens);
      });
    } catch (error) {
      console.error("Error caching tokens:", error);
    }
  }

  public static async clearTokenCache(): Promise<void> {
    try {
      await kongDB.tokens.clear();
    } catch (error) {
      console.error("Error clearing token cache:", error);
    }
  }

  // Optional: Add a method to get a single token from cache
  public static async getToken(canisterId: string): Promise<FE.Token | null> {
    try {
      const currentTime = Date.now();
      const token = await kongDB.tokens
        .where("canisterId")
        .equals(canisterId)
        .and(
          (token) => currentTime - token.timestamp < this.TOKEN_CACHE_DURATION,
        )
        .first();

      return token || null;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }

  // Optional: Add a method to update a single token in cache
  public static async updateToken(token: FE.Token): Promise<void> {
    try {
      await kongDB.tokens.put({
        ...token,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error updating token:", error);
    }
  }

  public static async enrichTokenWithMetadata(
    tokens: FE.Token[],
  ): Promise<PromiseSettledResult<FE.Token>[]> {
    const poolData = get(poolStore);
    const BATCH_SIZE = 1000; // Process 10 tokens at a time

    const processTokenBatch = async (tokenBatch: FE.Token[]) => {
      return Promise.all(
        tokenBatch.map(async (token) => {
          try {
            const [logo, price, fee] = await Promise.allSettled([
              this.getCachedLogo(token),
              this.getCachedPrice(token),
              token?.fee
                ? Promise.resolve(token.fee)
                : this.fetchTokenFee(token),
            ]);

            return {
              ...token,
              fee: fee.status === "fulfilled" ? fee.value : 0n,
              price: price.status === "fulfilled" ? price.value : 0,
              logo:
                logo.status === "fulfilled"
                  ? logo.value
                  : "/tokens/not_verified.webp",
            };
          } catch (error) {
            console.error(`Error enriching token ${token.symbol}:`, error);
            return null;
          }
        }),
      );
    };

    // Process tokens in batches
    const results = [];
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const batchResults = await processTokenBatch(batch);
      results.push(...batchResults);
    }

    return results.map((r) => ({
      status: r ? "fulfilled" : "rejected",
      value: r,
    })) as PromiseSettledResult<FE.Token>[];
  }

  private static async getCachedPrice(token: FE.Token): Promise<number> {
    const cached = this.priceCache.get(token.canister_id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }

    const price = await this.fetchPrice(token);
    this.priceCache.set(token.canister_id, {
      price,
      timestamp: Date.now(),
    });
    return price;
  }

  private static async getCachedLogo(token: FE.Token): Promise<string> {
    // Handle ICP special case first
    if (token.canister_id === ICP_CANISTER_ID) {
      const logo = DEFAULT_LOGOS[ICP_CANISTER_ID];
      await saveTokenLogo(token.canister_id, logo);
      return logo;
    }

    // Try to get from DB cache
    const cachedImage = await getTokenLogo(token.canister_id);
    if (cachedImage) {
      return cachedImage;
    }

    // Fetch from network if not cached
    try {
      const logo = await fetchTokenLogo(token);

      // Validate and cache the logo
      if (logo) {
        await saveTokenLogo(token.canister_id, logo);
        return logo;
      } else {
        await saveTokenLogo(token.canister_id, DEFAULT_LOGOS.DEFAULT);
        return DEFAULT_LOGOS.DEFAULT;
      }
    } catch (error) {
      console.error("Error fetching token logo:", error);
      const defaultLogo = DEFAULT_LOGOS.DEFAULT;
      await saveTokenLogo(token.canister_id, defaultLogo);
      return defaultLogo;
    }
  }

  public static async fetchBalances(
    tokens: FE.Token[],
    principalId: string = null,
  ): Promise<Record<string, FE.TokenBalance>> {
    if (!principalId) {
      return {};
    }

    // Create an array of promises for all tokens
    const balancePromises = tokens.map(async (token) => {
      try {
        let balance: bigint;

        if (token.icrc1 && principalId) {
          try {
            balance = await IcrcService.getIcrc1Balance(
              token,
              Principal.fromText(principalId),
            );
          } catch (error) {
            // Handle specific token errors more gracefully
            console.warn(
              `Unable to fetch balance for ${token.symbol} (${token.canister_id}):`,
              error.message
            );
            balance = BigInt(0);
          }
        } else {
          balance = BigInt(0);
        }

        const actualBalance = formatTokenAmount(
          balance.toString(),
          token.decimals,
        );
        
        let price = 0;
        try {
          price = await this.fetchPrice(token);
        } catch (priceError) {
          console.warn(`Failed to fetch price for ${token.symbol}:`, priceError.message);
        }
        
        const usdValue = parseFloat(actualBalance) * price;

        return {
          canister_id: token.canister_id,
          balance: {
            in_tokens: balance,
            in_usd: formatToNonZeroDecimal(usdValue),
            error: null
          },
        };
      } catch (err) {
        // Log detailed error information for debugging
        console.error(`Error processing token ${token.symbol}:`, {
          error: err,
          type: err.constructor.name,
          message: err.message,
          code: err.code
        });
        
        return {
          canister_id: token.canister_id,
          balance: {
            in_tokens: BigInt(0),
            in_usd: formatToNonZeroDecimal(0),
            error: err.message || 'Failed to fetch balance'
          },
        };
      }
    });

    // Wait for all balance promises to resolve
    const resolvedBalances = await Promise.allSettled(balancePromises);

    // Convert the array of results into a record
    const balances: Record<string, FE.TokenBalance> = {};
    resolvedBalances.forEach((result) => {
      if (result.status === "fulfilled") {
        const { canister_id, balance } = result.value;
        balances[canister_id] = balance;
      }
    });

    return balances;
  }

  public static async fetchBalance(
    token: FE.Token,
    principalId?: string,
    forceRefresh = false,
  ): Promise<FE.TokenBalance> {
    // Add cache check with a 10 second TTL
    if (!forceRefresh) {
      const cachedBalance = get(tokenStore).balances[token.canister_id];
      const lastUpdate = get(tokenStore).lastBalanceUpdate?.[token.canister_id] || 0;
      const now = Date.now();
      if (cachedBalance && (now - lastUpdate) < 10000) { // 10 second cache
        return cachedBalance;
      }
    }

    if (!token?.canister_id) {
      return {
        in_tokens: BigInt(0),
        in_usd: formatToNonZeroDecimal(0),
      };
    }

    const balance = await IcrcService.getIcrc1Balance(
      token,
      Principal.fromText(principalId),
    );

    const actualBalance = formatTokenAmount(balance.toString(), token.decimals);
    const price = await this.fetchPrice(token);
    const usdValue = parseFloat(actualBalance) * price;

    // Update last balance update time
    tokenStore.update(s => ({
      ...s,
      lastBalanceUpdate: {
        ...s.lastBalanceUpdate,
        [token.canister_id]: Date.now()
      }
    }));

    return {
      in_tokens: balance || BigInt(0),
      in_usd: formatToNonZeroDecimal(usdValue),
    };
  }

  public static async fetchPrices(
    tokens: FE.Token[],
  ): Promise<Record<string, number>> {
    const poolData = await PoolService.fetchPoolsData();

    // Create an array of promises for all tokens
    const pricePromises = tokens.map(async (token) => {
      const usdtPool = poolData.pools.find(
        (pool) =>
          (pool.address_0 === token.canister_id &&
            pool.symbol_1 === "ckUSDT") ||
          (pool.address_1 === token.canister_id && pool.symbol_0 === "ckUSDT"),
      );

      if (usdtPool) {
        return { canister_id: token.canister_id, price: usdtPool.price };
      } else {
        const icpPool = poolData.pools.find(
          (pool) =>
            pool.address_0 === token.canister_id && pool.symbol_1 === "ICP",
        );

        if (icpPool) {
          const icpUsdtPrice = await this.getUsdtPriceForToken(
            "ICP",
            poolData.pools,
          );
          return {
            canister_id: token.canister_id,
            price: icpUsdtPrice * icpPool.price,
          };
        } else {
          return { canister_id: token.canister_id, price: 0 };
        }
      }
    });

    // Wait for all price promises to resolve
    const resolvedPrices = await Promise.allSettled(pricePromises);

    // Convert the array of results into a record
    const prices: Record<string, number> = {};
    resolvedPrices.forEach((result) => {
      if (result.status === "fulfilled") {
        const { canister_id, price } = result.value;
        prices[canister_id] = price;
      }
    });
    prices[process.env.CANISTER_ID_CKUSDT_LEDGER] = 1;

    // Update tokens in DB correctly
    try {
      // Update each token individually instead of using bulkPut
      for (const token of tokens) {
        await kongDB.tokens.put({
          ...token,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error updating tokens in DB:', error);
    }

    return prices;
  }

  public static async fetchPrice(token: FE.Token): Promise<number> {
    const poolData = get(poolStore);

    const relevantPools = poolData.pools.filter(
      (pool) =>
        pool.address_0 === token.canister_id ||
        pool.address_1 === token.canister_id,
    );

    if (relevantPools.length === 0) return 0;

    let totalWeight = 0n;
    let weightedPrice = 0;

    for (const pool of relevantPools) {
      let price: number;
      let weight: bigint;

      if (pool.address_0 === token.canister_id) {
        if (pool.symbol_1 === "ICP") {
          const icpPrice = await this.getUsdtPriceForToken(
            "ICP",
            poolData.pools,
          );
          const usdtPrice = pool.price * icpPrice;
          price = usdtPrice;
        } else {
          price =
            pool.price *
            (await this.getUsdtPriceForToken(pool.symbol_1, poolData.pools));
        }
        weight = pool.balance_0;
      } else {
        if (pool.symbol_0 === "ckUSDT") {
          price = 1 / pool.price;
        } else {
          price =
            (1 / pool.price) *
            (await this.getUsdtPriceForToken(pool.symbol_0, poolData.pools));
        }
        weight = pool.balance_1;
      }

      if (price > 0 && weight > 0n) {
        weightedPrice += Number(weight) * price;
        totalWeight += weight;
      }
    }

    return totalWeight > 0n ? weightedPrice / Number(totalWeight) : 0;
  }

  private static async getUsdtPriceForToken(
    symbol: string,
    pools: BE.Pool[],
  ): Promise<number> {
    const usdtPool = pools.find(
      (p) =>
        (p.symbol_0 === symbol && p.symbol_1 === "ckUSDT") ||
        (p.symbol_1 === symbol && p.symbol_0 === "ckUSDT"),
    );

    if (usdtPool) {
      const price =
        usdtPool.symbol_1 === "ckUSDT" ? usdtPool.price : 1 / usdtPool.price;
      return price;
    }

    const icpPrice = await this.getUsdtPriceViaICP(symbol, pools);
    if (icpPrice > 0) {
      return icpPrice;
    }

    console.warn(`Unable to determine USDT price for token: ${symbol}`);
    return 0;
  }

  private static async getUsdtPriceViaICP(
    symbol: string,
    pools: BE.Pool[],
  ): Promise<number> {
    const tokenIcpPool = pools.find(
      (p) =>
        (p.symbol_0 === symbol && p.symbol_1 === "ICP") ||
        (p.symbol_1 === symbol && p.symbol_0 === "ICP"),
    );

    const icpUsdtPool = pools.find(
      (p) =>
        (p.symbol_0 === "ICP" && p.symbol_1 === "ckUSDT") ||
        (p.symbol_1 === "ICP" && p.symbol_0 === "ckUSDT"),
    );

    if (tokenIcpPool && icpUsdtPool) {
      const tokenPriceInIcp =
        tokenIcpPool.symbol_1 === "ICP"
          ? tokenIcpPool.price
          : 1 / tokenIcpPool.price;

      const icpPriceInUsdt =
        icpUsdtPool.symbol_1 === "ckUSDT"
          ? icpUsdtPool.price
          : 1 / icpUsdtPool.price;

      const combinedPrice = tokenPriceInIcp * icpPriceInUsdt;
      return combinedPrice;
    }

    console.warn(`No ICP pools found for token: ${symbol}`);
    return 0;
  }

  public static async getIcrc1TokenMetadata(canisterId: string): Promise<any> {
    try {
      const actor = await createAnonymousActorHelper(canisterId, "icrc1");
      return await actor.icrc1_metadata();
    } catch (error) {
      console.error("Error getting icrc1 token metadata:", error);
      throw error;
    }
  }

  public static async fetchUserTransactions(
    principalId: string,
    tokenId = "",
  ): Promise<any> {
    const actor = await createAnonymousActorHelper(kongBackendCanisterId, canisterIDLs.kong_backend);
    return await actor.txs([true]);
  }

  public static async claimFaucetTokens(): Promise<any> {
    try {
      const kongFaucetId = process.env.CANISTER_ID_KONG_FAUCET;
      const actor = await createAnonymousActorHelper(kongFaucetId, canisterIDLs.kong_faucet);
      return await actor.claim();
    } catch (error) {
      console.error("Error claiming faucet tokens:", error);
    }
  }

  public static async toggleFavorite(
    canister_id: string,
    walletId: string,
  ): Promise<void> {
    if (!walletId || !canister_id) return;

    const tokens = get(tokenStore);
    const currentFavorites = tokens.favoriteTokens[walletId] || [];
    const isFavorite = currentFavorites.includes(canister_id);

    if (isFavorite) {
      await kongDB.favorite_tokens
        .where("wallet_id")
        .equals(walletId)
        .and((favorite) => favorite.canister_id === canister_id)
        .delete();
      tokenStore.update((s) => ({
        ...s,
        favoriteTokens: {
          [walletId]: currentFavorites.filter((id) => id !== canister_id),
        },
      }));
    } else {
      await kongDB.favorite_tokens.add({
        wallet_id: walletId,
        canister_id: canister_id,
        timestamp: Date.now(),
      });
      tokenStore.update((s) => ({
        ...s,
        favoriteTokens: {
          [walletId]: [...currentFavorites, canister_id],
        },
      }));
    }
  }

  private static async calculate24hVolume(
    token: FE.Token,
    pools: BE.Pool[],
  ): Promise<bigint> {
    let total24hVolume = 0n;

    pools.forEach((pool) => {
      if (pool.address_0 === token.canister_id || pool.address_1 === token.canister_id) {
        if (pool.rolling_24h_volume) {
          total24hVolume += pool.rolling_24h_volume / (10n ** BigInt(token.decimals));
        }
      }
    });

    return total24hVolume;
  }

  private static async fetchTokenFee(token: FE.Token): Promise<bigint> {
    try {
      if (token.canister_id === ICP_CANISTER_ID) {
        // For ICP, use the standard transaction fee
        // ICP's fee is typically 10,000 e8s (0.0001 ICP)
        return BigInt(10000);
      } else {
        const actor = await createAnonymousActorHelper(token.canister_id, canisterIDLs.icrc1);
        const fee = await actor.icrc1_fee();
        return BigInt(fee.toString());
      }
    } catch (error) {
      console.error(`Error fetching fee for ${token.symbol}:`, error);
      // Provide a default fee if necessary
      return BigInt(10000); // Adjust default fee as appropriate
    }
  }
}
