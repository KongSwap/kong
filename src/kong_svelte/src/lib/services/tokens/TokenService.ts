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
import { fetchTokens } from "$lib/api/tokens";
import { toastStore } from "$lib/stores/toastStore";
import { tokenStore, tokenData } from "$lib/stores/tokenData";
import { userTokens } from "$lib/stores/userTokens";


export class TokenService {
  protected static instance: TokenService;

  public static async fetchTokens(): Promise<FE.Token[]> {
    try {
      const freshTokensResponse = await this.fetchFromNetwork();
      const existingTokens = get(tokenData);
      
      // Add timestamps and preserve previous prices
      const tokensWithTimestamp = freshTokensResponse.tokens.map(token => {
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
      tokenStore.set(tokensWithTimestamp);
      
      return tokensWithTimestamp;
    } catch (error) {
      console.error("[TokenService] Error fetching fresh tokens:", error);
      throw error;
    }
  }

  private static async fetchFromNetwork(): Promise<{ tokens: FE.Token[], total_count: number }> {
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
  }

  public static async fetchBalances(
    tokens?: FE.Token[],
    principalId?: string,
    forceRefresh: boolean = false,
  ): Promise<Record<string, TokenBalance>> {
    // Early validation
    if (!principalId && !get(auth).isConnected) {
      console.log('No principal ID and not connected');
      return {};
    }
    if (!tokens || tokens.length === 0) {
      console.log('No tokens provided');
      return {};
    }

    const authStore = get(auth);
    if (!authStore.isConnected) {
      console.log('Auth store not connected');
      return {};
    }

    try {
      let principal = principalId ? principalId : authStore.account.owner;
      if (typeof principal === "string") {
        principal = Principal.fromText(principal);
      }

      // Process tokens in batches of 25 with delays
      const batchSize = 25;
      const results = new Map<string, bigint>();
            
      // If forcing refresh, bypass the deduplication in IcrcService
      const batchPromises = [];
      for (let i = 0; i < tokens?.length || 0; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const promise = (async () => {
          try {
            // Force a new request by adding a timestamp to make each request unique
            const batchBalances = await IcrcService.batchGetBalances(
              batch.map(t => ({ ...t, timestamp: Date.now() })), 
              principal
            );
            
            // Only add valid balances
            for (const [canisterId, balance] of batchBalances.entries()) {
              if (balance !== undefined && balance !== null) {
                results.set(canisterId, balance);
              }
            }
          } catch (error) {
            console.error(`Error fetching batch ${i}-${i + batchSize}:`, error);
          }
        })();
        
        batchPromises.push(promise);
        
        // Add delay between batches
        if (i + batchSize < tokens.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Wait for all batches to complete
      await Promise.all(batchPromises);

      // Only process tokens that have valid balances
      const validBalances = tokens.reduce((acc, token) => {
        const balance = results.get(token.canister_id);
        if (balance !== undefined) {
          const price = token?.metrics?.price || 0;
          const tokenAmount = formatBalance(balance.toString(), token.decimals).replace(/,/g, '');
          const usdValue = parseFloat(tokenAmount) * Number(price);

          if (!isNaN(usdValue)) {
            acc[token.canister_id] = {
              in_tokens: balance,
              in_usd: usdValue.toString(),
            };
          }
        }
        return acc;
      }, {} as Record<string, TokenBalance>);

      return validBalances;
    } catch (error) {
      console.error('Error in fetchBalances:', error);
      return {};
    }
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
      const price = token?.metrics?.price || 0;
      const usdValue = parseFloat(actualBalance) * Number(price);

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


  public static async fetchUserTransactions(
    principalId: string, 
    page: number = 1, 
    limit: number = 50, 
    tx_type: 'swap' | 'send' | 'pool' | null = null
  ): Promise<{ transactions: any[], total_count: number }> {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (tx_type) {
        queryParams.append('tx_type', tx_type);
      }

      const url = `${INDEXER_URL}/api/users/${principalId}/transactions?${queryParams.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        transactions: data.transactions || [],
        total_count: data.total_count || 0
      };
    } catch (error) {
      console.error("Error fetching user transactions:", error);
      return { transactions: [], total_count: 0 };
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

      const tokens = get(userTokens).tokens;
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
        icrc1: Object.values(supportedStandards).find((standard: any) => standard.name === "ICRC-1") ? true : false,
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
