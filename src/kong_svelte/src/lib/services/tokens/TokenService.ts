// TokenService.ts
import { auth, canisterIDLs } from "$lib/services/auth";
import {
  formatToNonZeroDecimal,
  formatBalance,
} from "$lib/utils/numberFormatUtils";
import { get } from "svelte/store";
import {
  CKUSDT_CANISTER_ID,
  ICP_CANISTER_ID,
  INDEXER_URL,
  KONG_DATA_PRINCIPAL,
} from "$lib/constants/canisterConstants";
import { loadPools } from "$lib/services/pools/poolStore";
import { Principal } from "@dfinity/principal";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { kongDB } from "../db";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { fetchTokens } from "../indexer/api";
import { toastStore } from "$lib/stores/toastStore";
import { browser } from "$app/environment";

export class TokenService {
  protected static instance: TokenService;
  private static priceCache = new Map<
    string,
    { price: number; timestamp: number }
  >();
  private static readonly ICP_PRICE_CACHE_DURATION = 10 * 1000; // 10 seconds

  public static async fetchTokens(): Promise<FE.Token[]> {
    try {
      const freshTokens = await this.fetchFromNetwork();
      const existingTokens = await kongDB.tokens.toArray();
      
      // Add timestamps and preserve previous prices
      const tokensWithTimestamp = freshTokens.map(token => {
        const existingToken = existingTokens.find(et => et.canister_id === token.canister_id);
        return {
          ...token,
          timestamp: Date.now(),
          metrics: {
            ...token.metrics,
            previous_price: existingToken?.metrics?.price || token.metrics.price,
            price: token.metrics.price,
            volume_24h: token.metrics.volume_24h,
            total_supply: token.metrics.total_supply,
            market_cap: token.metrics.market_cap,
            tvl: token.metrics.tvl,
            updated_at: token.metrics.updated_at,
            price_change_24h: token.metrics.price_change_24h
          }
        };
      });

      // Store in DB with timestamp, using bulkPut with replace to trigger updates
      await kongDB.tokens.bulkPut(tokensWithTimestamp, { allKeys: true });
      
      return tokensWithTimestamp;
    } catch (error) {
      console.error("[TokenService] Error fetching fresh tokens:", error);
      throw error;
    }
  }

  private static async fetchFromNetwork(): Promise<FE.Token[]> {
    let retries = 3;
    let lastError: Error | null = null;

    // First try the indexer API
    while (retries > 0) {
      try {
        return await fetchTokens();
      } catch (error) {
        console.warn(
          `Token fetch attempt failed, ${retries - 1} retries left:`,
          error,
        );
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private static async getCachedPrice(token: FE.Token): Promise<number> {
    return Number((await kongDB.tokens.where("canister_id").equals(token.canister_id).first())?.metrics?.price || 0);
  }

  public static async fetchBalances(
    tokens?: FE.Token[],
    principalId?: string,
    forceRefresh: boolean = false,
  ): Promise<Record<string, TokenBalance>> {
    if (!tokens) tokens = await kongDB.tokens.toArray();
    if (!principalId && !get(auth).isConnected) return {};

    const authStore = get(auth);
    if (!authStore.isConnected) return {};

    let principal = principalId ? principalId : authStore.account.owner;
    if (typeof principal === "string") {
      principal = Principal.fromText(principal);
    }

    // Pre-fetch all prices in parallel while getting balances
    const [balances, prices] = await Promise.all([
      IcrcService.batchGetBalances(tokens, principal),
      Promise.all(tokens.map(token => this.getCachedPrice(token)))
    ]);

    // Process results in a single pass
    return tokens.reduce((acc, token, index) => {
      const balance = balances.get(token.canister_id) || BigInt(0);
      const price = prices[index] || 0;
      const tokenAmount = formatBalance(balance.toString(), token.decimals).replace(/,/g, '');
      const usdValue = parseFloat(tokenAmount) * price;

      acc[token.canister_id] = {
        in_tokens: balance,
        in_usd: usdValue.toString(),
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

      const balance = await IcrcService.getIcrc1Balance(
        token,
        typeof principalId === "string" ? Principal.fromText(principalId) : principalId,
      );

      const actualBalance = formatBalance(balance.toString(), token.decimals)?.replace(/,/g, '');
      const price = await this.fetchPrice(token);
      const usdValue = parseFloat(actualBalance) * price;

      let finalBalance;
      if (typeof balance === "object") {
        finalBalance = balance.default;
      } else {
        finalBalance = balance;
      }

      return {
        in_tokens: finalBalance,
        in_usd: usdValue.toString(),
      };
    } catch (error) {
      console.error(
        `Error fetching balance for token ${token.address}:`,
        error,
      );
      return {
        in_tokens: BigInt(0),
        in_usd: formatToNonZeroDecimal(0),
      };
    }
  }

  private static async calculateTokenPrice(
    token: FE.Token,
    pools: BE.Pool[],
  ): Promise<number> {
    // Special case for USDT
    if (token.canister_id === CKUSDT_CANISTER_ID) {
      return 1;
    }

    // Find all pools containing the token
    const relevantPools = pools.filter((pool) => {
      return (
        pool.address_0 === token.canister_id ||
        pool.address_1 === token.canister_id
      );
    });

    if (relevantPools.length === 0) {
      return 0;
    }

    // Calculate prices through different paths
    const [directUsdtPrice, icpPathPrice] = await Promise.all([
      // Direct USDT path
      this.calculateDirectUsdtPrice(token, relevantPools),
      // ICP intermediary path
      this.calculateIcpPath(token, pools),
    ]);

    // Filter out invalid prices and calculate weighted average
    const validPrices = [directUsdtPrice, icpPathPrice].filter(
      (p) => p.price > 0,
    );

    if (validPrices.length === 0) {
      return 0;
    }

    // Calculate weighted average based on liquidity
    const totalWeight = validPrices.reduce((sum, p) => sum + p.weight, 0);
    const weightedPrice = validPrices.reduce(
      (sum, p) => sum + (p.price * p.weight) / totalWeight,
      0,
    );

    return weightedPrice;
  }

  private static async calculateDirectUsdtPrice(
    token: FE.Token,
    pools: BE.Pool[],
  ): Promise<{ price: number; weight: number }> {
    const usdtPool = pools.find(
      (pool) =>
        (pool.address_0 === token.canister_id &&
          pool.address_1 === CKUSDT_CANISTER_ID) ||
        (pool.address_1 === token.canister_id &&
          pool.address_0 === CKUSDT_CANISTER_ID),
    );

    if (!usdtPool) {
      return { price: 0, weight: 0 };
    }

    // Calculate price based on pool balances and decimals
    const price =
      usdtPool.address_0 === token.canister_id
        ? usdtPool.price
        : 1 / usdtPool.price;

    // Calculate weight based on total liquidity
    const weight = Number(usdtPool.balance_0) + Number(usdtPool.balance_1);

    return { price, weight };
  }

  private static async calculateIcpPath(
    token: FE.Token,
    pools: BE.Pool[],
  ): Promise<{ price: number; weight: number }> {
    // If this is ICP itself, return the API price directly
    if (token.canister_id === ICP_CANISTER_ID) {
      const price = await this.getIcpPrice();
      return { price, weight: 1 };
    }

    // For other tokens using ICP path
    const icpPool = pools.find(
      (pool) =>
        (pool.address_0 === token.canister_id && pool.symbol_1 === "ICP") ||
        (pool.address_1 === token.canister_id && pool.symbol_0 === "ICP"),
    );

    if (!icpPool) {
      return { price: 0, weight: 0 };
    }

    const icpPrice = await this.getIcpPrice();
    const tokenIcpPrice =
      icpPool.address_0 === token.canister_id
        ? icpPool.price
        : 1 / icpPool.price;

    const weight = Number(icpPool.balance_0) + Number(icpPool.balance_1);
    return {
      price: tokenIcpPrice * icpPrice,
      weight,
    };
  }

  public static async fetchPrice(token: FE.Token): Promise<number> {
    try {
      // Get current pools
      const pools = await kongDB.pools.toArray();
      if (!pools?.length) {
        await loadPools();
      }
      // Calculate price using pools - use the static class method
      return await this.calculateTokenPrice(token, pools);
    } catch (error) {
      console.error(
        `[TokenService] Error fetching price for ${token.symbol}:`,
        error,
      );
      return 0;
    }
  }

  public static async fetchUserTransactions(principalId: string, page: number = 1, limit: number = 50, tx_type: string = null): Promise<any> {
    try {
      console.log("Loading user transactions...");
      const url = `${INDEXER_URL}/api/users/${principalId}/transactions?page=${page}&limit=${limit}${tx_type ? `&tx_type=${tx_type}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching user transactions:", error);
      return { Ok: [] };
    }
  }

  public static async getIcpPrice(): Promise<number> {
    try {
      const now = Date.now();
      const cached = this.priceCache.get("ICP_USD");
      if (cached && now - cached.timestamp < this.ICP_PRICE_CACHE_DURATION) {
        return cached.price;
      }
      const pool = await kongDB.pools
        .where("address_0")
        .equals(ICP_CANISTER_ID)
        .and((p) => p.address_1 === CKUSDT_CANISTER_ID)
        .first();

      return Number(pool?.price);
    } catch (error) {
      console.error("Error fetching ICP price from CoinCap:", error);

      // Return cached price if available, even if stale
      const cached = this.priceCache.get("ICP_USD");
      if (cached) {
        return cached.price;
      }

      return 0;
    }
  }

  public static async faucetClaim() {
    const actor = auth.pnp.getActor(
      process.env.CANISTER_ID_KONG_FAUCET,
      canisterIDLs.kong_faucet,
      { anon: false, requiresSigning: false },
    );
    const result = await actor.claim();

    if (result.Ok) {
      console.log("Tokens minted successfully");
      toastStore.success("Tokens minted successfully");
    } else {
      console.error("Error minting tokens:", result.Err);
      toastStore.error("Error minting tokens");
    }
  }

  public static async fetchTokenMetadata(canisterId: string): Promise<FE.Token | null> {
    try {
      const actor = await createAnonymousActorHelper(canisterId, canisterIDLs.icrc2);
      if (!actor) {
        throw new Error('Failed to create token actor');
      }

      const [name, symbol, decimals, fee, supportedStandards, metadata, totalSupply] = await Promise.all([
        actor.icrc1_name(),
        actor.icrc1_symbol(),
        actor.icrc1_decimals(),
        actor.icrc1_fee(),
        actor.icrc1_supported_standards(),
        actor.icrc1_metadata(),
        actor.icrc1_total_supply()
      ]);

      const getLogo = (metadata: Array<[string, any]>): string => {
        for (const [key, value] of metadata) {
          if (key === 'icrc1:logo' || key === 'icrc1_logo' || key === 'icrc1:icrc1_logo') {
            // The value is an object that contains the logo data
            if (typeof value === 'object' && value !== null) {
              // Access the Text value inside the object
              const logoValue = Object.values(value)[0];
              return typeof logoValue === 'string' ? logoValue : '';
            }
          }
        }
        return '';
      };

      const tokens = await kongDB.tokens.toArray();
      const tokenId = tokens.length + 1000;
      return {
        canister_id: canisterId,
        name: name.toString(),
        symbol: symbol.toString(),
        decimals: Number(decimals),
        address: canisterId,
        fee: fee.toString(),
        fee_fixed: fee.toString(),
        token: canisterId,
        icrc1: Object.values(supportedStandards).find((standard: any) => standard.name === "ICRC-2") ? true : false,
        icrc2: Object.values(supportedStandards).find((standard: any) => standard.name === "ICRC-2") ? true : false,
        icrc3: Object.values(supportedStandards).find((standard: any) => standard.name === "ICRC-3") ? true : false,
        pool_symbol: "",
        pools: [],
        timestamp: Date.now(),
        metrics: {
          price: "0",
          volume_24h: "0",
          total_supply: totalSupply.toString(),
          market_cap: "0",
          tvl: "0",
          updated_at: new Date().toISOString(),
          price_change_24h: "0"
        },
        balance: "0",
        logo_url: getLogo(metadata as Array<[string, any]>),
        token_type: "IC",
        token_id: tokenId,
        chain: "IC",
        total_24h_volume: "0"
      };
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      toastStore.error('Error fetching token metadata');
      return null;
    }
  }
}
