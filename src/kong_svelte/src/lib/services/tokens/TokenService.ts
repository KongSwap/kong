// TokenService.ts
import { auth } from "$lib/services/auth";
import { PoolService } from "../../services/pools/PoolService";
import {
  formatToNonZeroDecimal,
  formatTokenAmount,
} from "$lib/utils/numberFormatUtils";
import { get } from "svelte/store";
import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID, KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
import { poolStore } from "$lib/services/pools/poolStore";
import { Principal } from "@dfinity/principal";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { kongDB } from "../db";
import { tokenStore } from "./tokenStore";
import { idlFactory as kongBackendIDL } from "../../../../../declarations/kong_backend";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { fetchTokens } from "../indexer/api";
import { idlFactory as kongFaucetIDL } from "../../../../../declarations/kong_faucet";
import { toastStore } from "$lib/stores/toastStore";

export class TokenService {
  protected static instance: TokenService;
  private static priceCache = new Map<
    string,
    { price: number; timestamp: number }
  >();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  public static readonly TOKEN_CACHE_DURATION =  20 * 1000; // 5 minutes

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  public static async fetchTokens(): Promise<FE.Token[]> {
    // First try to get cached tokens
    let cachedTokens: FE.Token[] = [];
    try {
      cachedTokens = await kongDB.tokens
        .where('timestamp')
        .above(Date.now() - this.TOKEN_CACHE_DURATION)
        .toArray() as FE.Token[];
    } catch (error) {
      console.error("Error fetching cached tokens:", error);
    }

    // If we have cached tokens, update the store immediately
    if (cachedTokens.length > 0) {
      tokenStore.update(state => ({
        ...state,
        tokens: cachedTokens,
        lastTokensFetch: Date.now(),
        isLoading: true // Keep loading true while fetching fresh data
      }));
    }

    try {
      // Fetch fresh data in the background
      const freshTokens = await this.fetchFromNetwork();
      
      // Update cache with fresh data
      await kongDB.tokens.bulkPut(freshTokens.map(token => ({
        ...token,
        timestamp: Date.now()
      })));

      // Update store with fresh data
      tokenStore.update(state => ({
        ...state,
        tokens: freshTokens,
        lastTokensFetch: Date.now(),
        isLoading: false
      }));
      
      return freshTokens;
    } catch (error) {
      console.error("Error fetching fresh tokens:", error);
      
      // If we failed to fetch fresh data but have cached data, use that
      if (cachedTokens.length > 0) {
        tokenStore.update(state => ({
          ...state,
          isLoading: false
        }));
        return cachedTokens;
      }
      
      tokenStore.update(state => ({
        ...state,
        isLoading: false,
        error: "Failed to fetch tokens"
      }));
      return [];
    }
  }

  private static async fetchFromNetwork(): Promise<FE.Token[]> {
    let retries = 3;

    while (retries > 0) {
      try {   
        return await fetchTokens();
      } catch (error) {
        console.warn(`Token fetch attempt failed, ${retries - 1} retries left:`, error);
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return [];
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

  private static async getCachedPrice(token: FE.Token): Promise<number> {
    const cacheKey = token.canister_id;
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }

    const price = await this.fetchPrice(token);
    this.priceCache.set(cacheKey, {
      price,
      timestamp: Date.now()
    });
    
    return price;
  }

  public static async fetchBalances(
    tokens?: FE.Token[],
    principalId?: string,
    forceRefresh: boolean = false
  ): Promise<Record<string, TokenBalance>> {
    if (!tokens) tokens = get(tokenStore).tokens;
    if (!principalId && !get(auth).isConnected) return {};

    const principal = principalId ? Principal.fromText(principalId) : get(auth).account.owner;
    
    if(forceRefresh) {
      Promise.all(
        tokens.map(token => this.fetchBalance(token, principalId, true))
      );
    }
    // Use batch balance fetching
    const balances = await IcrcService.batchGetBalances(tokens, principal);
    
    // Fetch all prices in parallel
    const prices = await Promise.all(
      tokens.map(token => this.getCachedPrice(token))
    );
    
    return tokens.reduce((acc, token, index) => {
      const balance = balances.get(token.canister_id) || BigInt(0);
      const price = prices[index] || 0;
      const tokenAmount = formatTokenAmount(balance.toString(), token.decimals);
      const usdValue = parseFloat(tokenAmount) * price;
      
      acc[token.canister_id] = {
        in_tokens: balance,
        in_usd: formatToNonZeroDecimal(usdValue)
      };
      return acc;
    }, {} as Record<string, TokenBalance>);
  }

  public static async fetchBalance(
    token: FE.Token,
    principalId?: string,
    forceRefresh = false,
  ): Promise<FE.TokenBalance> {
    try {
      // Return zero balance if no token or principal
      if (!token?.canister_id || !principalId) {
        return {
          in_tokens: BigInt(0),
          in_usd: formatToNonZeroDecimal(0),
        };
      }

      // Check if principal is valid
      try {
        Principal.fromText(principalId);
      } catch (e) {
        console.warn(`Invalid principal ID: ${principalId}`);
        return {
          in_tokens: BigInt(0),
          in_usd: formatToNonZeroDecimal(0),
        };
      }

      // Check cache unless force refresh is requested
      if (forceRefresh === false) {
        const now = Date.now();
        const lastUpdate = get(tokenStore).lastBalanceUpdate?.[token.address] || 0;
        const cachedBalance = get(tokenStore).balances?.[token.address];

        if (cachedBalance && (now - lastUpdate) < 12000) { // 12 second cache
          return cachedBalance;
        }
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
          [token.address]: Date.now()
        }
      }));

      return {
        in_tokens: balance,
        in_usd: formatToNonZeroDecimal(usdValue),
      };
    } catch (error) {
      console.error(`Error fetching balance for token ${token.address}:`, error);
      return {
        in_tokens: BigInt(0),
        in_usd: formatToNonZeroDecimal(0),
      };
    }
  }

  public static async fetchPrices(
    tokens: FE.Token[],
  ): Promise<Record<string, number>> {
    
    // Ensure pools are loaded first
    const poolData = await PoolService.fetchPoolsData();
    if (!poolData?.pools?.length) {
      // console.warn('No pools available for price calculation');
      return tokens.reduce((acc, token) => {
        if (token.canister_id) {
          acc[token.canister_id] = 0;
        }
        return acc;
      }, {} as Record<string, number>);
    }
    
    // Create an array of promises for all tokens
    const pricePromises = tokens.map(async (token) => {
      try {
        if(token.canister_id === ICP_CANISTER_ID) {
          return {
            canister_id: token.canister_id,
            price: await this.getIcpPrice()
          }
        }
    
        const price = await this.calculateTokenPrice(token, poolData.pools);
        return { 
          canister_id: token.canister_id, 
          price 
        };
      } catch (error) {
        console.warn(`Failed to calculate price for token ${token.symbol}:`, error);
        return { 
          canister_id: token.canister_id, 
          price: 0 
        };
      }
    });

    const resolvedPrices = await Promise.allSettled(pricePromises);
    const prices: Record<string, number> = {};

    // Process results and update DB
    await Promise.all(resolvedPrices.map(async (result) => {
      if (result.status === "fulfilled") {
        const { canister_id, price } = result.value;
        if (canister_id) {
          prices[canister_id] = price;
          
          try {
            const token = tokens.find(t => t.canister_id === canister_id);
            if (token) {
              await kongDB.tokens.put({
                ...token,
                timestamp: Date.now()
              });
            }
          } catch (error) {
            console.error(`Error updating token ${canister_id} in DB:`, error);
          }
        }
      }
    }));

    // Set USDT price explicitly
    if (process.env.CANISTER_ID_CKUSDT_LEDGER) {
      prices[process.env.CANISTER_ID_CKUSDT_LEDGER] = 1;
    }
    
    return prices;
  }

  private static async calculateTokenPrice(
    token: FE.Token, 
    pools: BE.Pool[]
  ): Promise<number> {
    // Special case for USDT
    if (token.canister_id === CKUSDT_CANISTER_ID) {
      return 1;
    }

    // Find all pools containing the token
    const relevantPools = pools.filter(pool => {
      return pool.address_0 === token.canister_id || 
             pool.address_1 === token.canister_id;
    });

    if (relevantPools.length === 0) {
      return 0;
    }

    // Calculate prices through different paths
    const [directUsdtPrice, icpPathPrice] = await Promise.all([
      // Direct USDT path
      this.calculateDirectUsdtPrice(token, relevantPools),
      // ICP intermediary path
      this.calculateIcpPath(token, pools)
    ]);

    // Filter out invalid prices and calculate weighted average
    const validPrices = [directUsdtPrice, icpPathPrice].filter(p => p.price > 0);
    
    if (validPrices.length === 0) {
      return 0;
    }

    // Calculate weighted average based on liquidity
    const totalWeight = validPrices.reduce((sum, p) => sum + p.weight, 0);
    const weightedPrice = validPrices.reduce((sum, p) => 
      sum + (p.price * p.weight / totalWeight), 0
    );

    return weightedPrice;
  }

  private static async calculateDirectUsdtPrice(
    token: FE.Token, 
    pools: BE.Pool[]
  ): Promise<{price: number, weight: number}> {
    const usdtPool = pools.find(pool => 
      (pool.address_0 === token.canister_id && pool.address_1 === CKUSDT_CANISTER_ID) ||
      (pool.address_1 === token.canister_id && pool.address_0 === CKUSDT_CANISTER_ID)
    );

    if (!usdtPool) {
      return { price: 0, weight: 0 };
    }

    // Calculate price based on pool balances and decimals
    const price = usdtPool.address_0 === token.canister_id ? 
      usdtPool.price : 
      1 / usdtPool.price;

    // Calculate weight based on total liquidity
    const weight = Number(usdtPool.balance_0) + Number(usdtPool.balance_1);
    
    return { price, weight };
  }

  private static async calculateIcpPath(
    token: FE.Token, 
    pools: BE.Pool[]
  ): Promise<{price: number, weight: number}> {
    // If this is ICP itself, return the API price directly
    if (token.canister_id === ICP_CANISTER_ID) {
      const price = await this.getIcpPrice();
      return { price, weight: 1 };
    }

    // For other tokens using ICP path
    const icpPool = pools.find(pool =>
      (pool.address_0 === token.canister_id && pool.symbol_1 === "ICP") ||
      (pool.address_1 === token.canister_id && pool.symbol_0 === "ICP")
    );

    if (!icpPool) {
      return { price: 0, weight: 0 };
    }

    const icpPrice = await this.getIcpPrice();
    const tokenIcpPrice = icpPool.address_0 === token.canister_id ? 
      icpPool.price : 
      1 / icpPool.price;

    const weight = Number(icpPool.balance_0) + Number(icpPool.balance_1);
    return {
      price: tokenIcpPrice * icpPrice,
      weight
    };
  }

  public static async fetchPrice(token: FE.Token): Promise<number> {
    try {
      // Get current pools
      const pools = get(poolStore);
      if (!pools?.pools?.length) {
        await poolStore.loadPools();
      }
      // Calculate price using pools - use the static class method
      return await TokenService.calculateTokenPrice(token, pools.pools);;
    } catch (error) {
      console.error(`[TokenService] Error fetching price for ${token.symbol}:`, error);
      return 0;
    }
  }

  public static async fetchUserTransactions(): Promise<any> {
    try {
      if (!KONG_BACKEND_CANISTER_ID) {
        console.warn('Kong Data canister ID is missing');
        return { Ok: [] };
      }

      if (!kongBackendIDL) {
        console.warn('Kong Data IDL is missing');
        return { Ok: [] };
      }

      const actor = await createAnonymousActorHelper(KONG_BACKEND_CANISTER_ID, kongBackendIDL); 
      const txs = await actor.txs([auth.pnp?.account?.owner?.toString()]);
      
      return txs;
    } catch (error) {
      console.error('Error fetching user transactions:', error);
      return { Ok: [] };
    }
  }


  public static async getIcpPrice(): Promise<number> {
    try {
      const now = Date.now();
      const cached = this.priceCache.get('ICP_USD');
      if (cached && now - cached.timestamp < this.CACHE_DURATION) {
        return cached.price;
      }
      const price = get(poolStore).pools.find(pool => pool.address_0 === ICP_CANISTER_ID && pool.address_1 === CKUSDT_CANISTER_ID)?.price;
      // Update cache
      if (Number(price) > 0) {
        this.priceCache.set('ICP_USD', {
          price,
          timestamp: now
        });
      }

      return Number(price);
    } catch (error) {
      console.error('Error fetching ICP price from CoinCap:', error);
      
      // Return cached price if available, even if stale
      const cached = this.priceCache.get('ICP_USD');
      if (cached) {
        return cached.price;
      }
      
      return 0;
    }
  }

  public static async faucetClaim() {
    const actor = auth.pnp.getActor(process.env.CANISTER_ID_KONG_FAUCET, kongFaucetIDL, { anon: false, requiresSigning: false });
    const result = await actor.claim();
    
    if(result.Ok) {
      console.log('Tokens minted successfully');
      toastStore.success('Tokens minted successfully');
    } else {
      console.error('Error minting tokens:', result.Err);
      toastStore.error('Error minting tokens');
    }
  }
}
