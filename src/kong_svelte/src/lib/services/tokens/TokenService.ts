// TokenService.ts
import { auth, canisterIDLs } from "$lib/services/auth";
import { PoolService } from "../../services/pools/PoolService";
import {
  formatToNonZeroDecimal,
  formatBalance,
} from "$lib/utils/numberFormatUtils";
import { get } from "svelte/store";
import {
  CKUSDT_CANISTER_ID,
  ICP_CANISTER_ID,
  KONG_BACKEND_CANISTER_ID,
} from "$lib/constants/canisterConstants";
import { poolStore } from "$lib/services/pools/poolStore";
import { Principal } from "@dfinity/principal";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { kongDB } from "../db";
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
  private static readonly CACHE_DURATION = 1 * 60 * 1000; // 1 minute
  public static readonly TOKEN_CACHE_DURATION = 1 * 60 * 1000; // 1 minute

  public static async fetchTokens(): Promise<FE.Token[]> {
    // 1. Get cached tokens first
    let cachedTokens: FE.Token[] = [];
    try {
      cachedTokens = (await kongDB.tokens
        .where("timestamp")
        .above(Date.now() - this.TOKEN_CACHE_DURATION)
        .toArray()) as FE.Token[];
    } catch (error) {
      console.error("Error fetching cached tokens:", error);
    }

    // 3. Fetch fresh data from network (which may or may not have price fields)
    let freshTokens: FE.Token[] = [];
    try {
      freshTokens = await this.fetchFromNetwork();
    } catch (error) {
      console.error("Error fetching fresh tokens:", error);
    }

    await kongDB.tokens.bulkPut(
      freshTokens.map((token) => ({
        ...token,
        timestamp: Date.now(),
      })),
    );

    return freshTokens;
  }

  private static async fetchFromNetwork(): Promise<FE.Token[]> {
    let retries = 3;

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
    return Number((await kongDB.tokens.where("canister_id").equals(token.canister_id).first())?.metrics?.price || 0);
  }

  public static async fetchBalances(
    tokens?: FE.Token[],
    principalId?: string,
    forceRefresh: boolean = false,
  ): Promise<Record<string, TokenBalance>> {
    if (!tokens) tokens = await kongDB.tokens.toArray();
    if (!principalId && !get(auth).isConnected) return {};

    let principal = principalId
      ? principalId
      : get(auth).account.owner;

    if (typeof principal === "string") {
      principal = Principal.fromText(principal);
    }

    if (forceRefresh) {
      Promise.all(
        tokens.map((token) => this.fetchBalance(token, principalId, true)),
      );
    }
    // Use batch balance fetching
    const balances = await IcrcService.batchGetBalances(tokens, principal);
    const prices = await Promise.all(
      tokens.map((token) => this.getCachedPrice(token)),
    );

    return tokens.reduce(
      (acc, token, index) => {
        const balance = balances.get(token.canister_id) || BigInt(0);
        const price = prices[index] || 0;
        const tokenAmount = formatBalance(balance.toString(), token.decimals).replace(/,/g, '');
        const usdValue = parseFloat(tokenAmount) * price;

        acc[token.canister_id] = {
          in_tokens: balance,
          in_usd: usdValue.toString(),
        };
        return acc;
      },
      {} as Record<string, TokenBalance>,
    );
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

      const balance = await IcrcService.getIcrc1Balance(
        token,
        Principal.fromText(principalId),
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

  public static async fetchPrices(
    tokens: FE.Token[],
  ): Promise<Record<string, number>> {
    // Ensure pools are loaded first
    const poolData = await PoolService.fetchPoolsData();
    if (!poolData?.pools?.length) {
      return tokens.reduce(
        (acc, token) => {
          if (token.canister_id) {
            acc[token.canister_id] = 0;
          }
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    // Create an array of promises for all tokens
    const pricePromises = tokens.map(async (token) => {
      try {
        if (token.canister_id === ICP_CANISTER_ID) {
          return {
            canister_id: token.canister_id,
            price: await this.getIcpPrice(),
          };
        }

        const price = await this.calculateTokenPrice(token, poolData.pools);
        return {
          canister_id: token.canister_id,
          price,
        };
      } catch (error) {
        console.warn(
          `Failed to calculate price for token ${token.symbol}:`,
          error,
        );
        return {
          canister_id: token.canister_id,
          price: 0,
        };
      }
    });

    const resolvedPrices = await Promise.allSettled(pricePromises);
    const prices: Record<string, number> = {};

    // Process results and update DB
    await Promise.all(
      resolvedPrices.map(async (result) => {
        if (result.status === "fulfilled") {
          const { canister_id, price } = result.value;
          if (canister_id) {
            prices[canister_id] = price;

            try {
              const token = tokens.find((t) => t.canister_id === canister_id);
              if (token) {
                await kongDB.tokens.put({
                  ...token,
                  timestamp: Date.now(),
                });
              }
            } catch (error) {
              console.error(
                `Error updating token ${canister_id} in DB:`,
                error,
              );
            }
          }
        }
      }),
    );

    // Set USDT price explicitly
    if (process.env.CANISTER_ID_CKUSDT_LEDGER) {
      prices[process.env.CANISTER_ID_CKUSDT_LEDGER] = 1;
    }

    return prices;
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
        await poolStore.loadPools();
      }
      // Calculate price using pools - use the static class method
      return await TokenService.calculateTokenPrice(token, pools);
    } catch (error) {
      console.error(
        `[TokenService] Error fetching price for ${token.symbol}:`,
        error,
      );
      return 0;
    }
  }

  public static async fetchUserTransactions(): Promise<any> {
    try {
      if (!KONG_BACKEND_CANISTER_ID) {
        console.warn("Kong Data canister ID is missing");
        return { Ok: [] };
      }

      if (!kongBackendIDL) {
        console.warn("Kong Data IDL is missing");
        return { Ok: [] };
      }

      const actor = await createAnonymousActorHelper(
        KONG_BACKEND_CANISTER_ID,
        kongBackendIDL,
      );
      const txs = await actor.txs([auth.pnp?.account?.owner?.toString()]);

      return txs;
    } catch (error) {
      console.error("Error fetching user transactions:", error);
      return { Ok: [] };
    }
  }

  public static async getIcpPrice(): Promise<number> {
    try {
      const now = Date.now();
      const cached = this.priceCache.get("ICP_USD");
      if (cached && now - cached.timestamp < this.CACHE_DURATION) {
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
      kongFaucetIDL,
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
        on_kong: false,
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
