// TokenService.ts
import { auth, canisterIDLs } from "$lib/services/auth";
import {
  formatToNonZeroDecimal,
  formatBalance,
} from "$lib/utils/numberFormatUtils";
import { get } from "svelte/store";
import {
  API_URL,
} from "$lib/api/index";
import { Principal } from "@dfinity/principal";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { fetchTokens, fetchAllTokens, fetchTokensByCanisterId } from "$lib/api/tokens";
import { toastStore } from "$lib/stores/toastStore";
import { tokenStore, tokenData } from "$lib/stores/tokenData";
import { userTokens } from "$lib/stores/userTokens";
import { TransactionSerializer } from "$lib/serializers/TransactionSerializer";
import { TokenSerializer } from "$lib/serializers/TokenSerializer";

/**
 * TokenService
 * Responsible for token-related business logic and state management
 */
export class TokenService {
  /**
   * Fetches tokens from the network and updates the token store
   * @param fetchAll Whether to fetch all tokens or just the first page
   */
  public static async fetchTokens(fetchAll: boolean = false): Promise<FE.Token[]> {
    try {
      let tokens: FE.Token[];
      
      if (fetchAll) {
        // Fetch all tokens across all pages
        tokens = await fetchAllTokens();
      } else {
        // Fetch just the first page with default pagination
        const freshTokensResponse = await this.fetchFromNetwork();
        tokens = freshTokensResponse.tokens;
      }
      
      const existingTokens = get(tokenData);
      
      // Process tokens with timestamps and preserve previous prices
      const processedTokens = this.processTokensWithMetadata(
        tokens, 
        existingTokens
      );

      // Update the token store
      tokenStore.set(processedTokens);
      
      return processedTokens;
    } catch (error) {
      console.error("[TokenService] Error fetching tokens:", error);
      throw error;
    }
  }

  /**
   * Fetches tokens with pagination
   * @param page Page number (1-based)
   * @param limit Number of items per page
   * @param search Optional search term
   */
  public static async fetchTokensWithPagination(
    page: number = 1, 
    limit: number = 150,
    search?: string
  ): Promise<{
    tokens: FE.Token[],
    total_count: number,
    page: number,
    limit: number,
    total_pages: number
  }> {
    try {
      const response = await fetchTokens({
        page,
        limit,
        search
      });
      
      // Process tokens with metadata but don't update the store
      // This is useful for UI components that need paginated data
      const processedTokens = this.processTokensWithMetadata(
        response.tokens,
        get(tokenData)
      );
      
      return {
        ...response,
        tokens: processedTokens
      };
    } catch (error) {
      console.error("[TokenService] Error fetching paginated tokens:", error);
      throw error;
    }
  }

  /**
   * Process tokens with timestamps and metadata
   * @private
   */
  private static processTokensWithMetadata(
    tokens: FE.Token[], 
    existingTokens: FE.Token[]
  ): FE.Token[] {
    return tokens.map(token => {
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
  }

  /**
   * Fetches tokens from the network with retry logic
   * @private
   */
  private static async fetchFromNetwork(): Promise<{ 
    tokens: FE.Token[], 
    total_count: number,
    page: number,
    limit: number,
    total_pages: number
  }> {
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
    
    // This should never be reached due to the throw in the loop,
    // but TypeScript requires a return statement
    throw new Error("Failed to fetch tokens after retries");
  }

  /**
   * Fetches tokens by canister IDs with enhanced error handling
   */
  public static async fetchTokensByCanisterId(canisterIds: string[]): Promise<FE.Token[]> {
    if (!canisterIds || canisterIds.length === 0) {
      return [];
    }
    
    try {
      const tokens = await fetchTokensByCanisterId(canisterIds);
      
      // Process tokens with metadata
      const existingTokens = get(tokenData);
      return this.processTokensWithMetadata(tokens, existingTokens);
    } catch (error) {
      console.error("[TokenService] Error fetching tokens by canister ID:", error);
      return [];
    }
  }

  /**
   * Fetches balances for multiple tokens
   */
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

    try {
      let principal = principalId ? principalId : authStore.account?.owner;
      if (typeof principal === "string") {
        principal = Principal.fromText(principal);
      }

      // Process tokens in batches
      return await this.fetchBalancesInBatches(tokens, principal, forceRefresh);
    } catch (error) {
      console.error('Error in fetchBalances:', error);
      return {};
    }
  }

  /**
   * Fetches balances in batches to avoid overwhelming the network
   * @private
   */
  private static async fetchBalancesInBatches(
    tokens: FE.Token[],
    principal: any,
    forceRefresh: boolean
  ): Promise<Record<string, TokenBalance>> {
    const batchSize = 25;
    const results = new Map<string, bigint>();
          
    // Process tokens in batches with delays
    const batchPromises = [];
    for (let i = 0; i < tokens.length; i += batchSize) {
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

    // Process the results
    return this.processBalanceResults(tokens, results);
  }

  /**
   * Processes balance results into token balances
   * @private
   */
  private static processBalanceResults(
    tokens: FE.Token[],
    results: Map<string, bigint>
  ): Record<string, TokenBalance> {
    return tokens.reduce((acc, token) => {
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
  }

  /**
   * Fetches balance for a single token
   */
  public static async fetchBalance(
    token: FE.Token,
    principalId?: string,
    forceRefresh = false,
  ): Promise<FE.TokenBalance> {
    try {
      // Return zero balance if no token or principal
      if (!token?.canister_id || !principalId) {
        return this.createZeroBalance();
      }

      const balance = await IcrcService.getIcrc1Balance(
        token,
        typeof principalId === "string" ? Principal.fromText(principalId) : principalId,
      );

      return this.calculateTokenBalance(token, balance);
    } catch (error) {
      console.error(
        `Error fetching balance for token ${token.address}:`,
        error,
      );
      return this.createZeroBalance();
    }
  }

  /**
   * Creates a zero balance object
   * @private
   */
  private static createZeroBalance(): FE.TokenBalance {
    return {
      in_tokens: BigInt(0),
      in_usd: formatToNonZeroDecimal(0),
    };
  }

  /**
   * Calculates token balance with USD value
   * @private
   */
  private static calculateTokenBalance(token: FE.Token, balance: any): FE.TokenBalance {
    const actualBalance = formatBalance(balance.toString(), token.decimals)?.replace(/,/g, '');
    const price = token?.metrics?.price || 0;
    const usdValue = parseFloat(actualBalance) * Number(price);

    let finalBalance;
    if (balance && typeof balance === "object") {
      finalBalance = balance.default;
    } else {
      finalBalance = balance || BigInt(0);
    }

    return {
      in_tokens: finalBalance,
      in_usd: usdValue.toString(),
    };
  }

  /**
   * Fetches user transactions
   */
  public static async fetchUserTransactions(
    principalId: string, 
    cursor?: number,
    limit: number = 40, 
    tx_type: 'swap' | 'pool' | 'send' = 'swap'
  ): Promise<{ transactions: any[], has_more: boolean, next_cursor?: number }> {
    try {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
      });

      if (cursor) {
        queryParams.append('cursor', cursor.toString());
      }
      
      // Determine the appropriate endpoint based on transaction type
      const url = this.getTransactionEndpoint(principalId, tx_type, queryParams);
      
      const response = await fetch(url);
      const responseText = await response.text();
      
      // Handle empty response
      if (!responseText.trim()) {
        console.log('Empty response received');
        return {
          transactions: [],
          has_more: false
        };
      }
      
      // Parse the response
      return this.parseTransactionResponse(response, responseText, url);
    } catch (error) {
      console.error("Error fetching user transactions:", {
        error,
        principalId,
        cursor,
        limit,
        tx_type
      });
      
      return {
        transactions: [],
        has_more: false
      };
    }
  }

  /**
   * Gets the transaction endpoint URL
   * @private
   */
  private static getTransactionEndpoint(
    principalId: string, 
    tx_type: string, 
    queryParams: URLSearchParams
  ): string {
    if (tx_type === 'pool') {
      return `${API_URL}/api/users/${principalId}/transactions/liquidity?${queryParams.toString()}`;
    } else if (tx_type === 'send') {
      return `${API_URL}/api/users/${principalId}/transactions/send?${queryParams.toString()}`;
    } else {
      return `${API_URL}/api/users/${principalId}/transactions/swap?${queryParams.toString()}`;
    }
  }

  /**
   * Parses transaction response
   * @private
   */
  private static parseTransactionResponse(
    response: Response, 
    responseText: string, 
    url: string
  ): { transactions: any[], has_more: boolean, next_cursor?: number } {
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', {
        error: parseError,
        responseText: responseText,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      return {
        transactions: [],
        has_more: false
      };
    }
    
    if (!response.ok) {
      console.error('HTTP error:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
        url: url
      });
      return {
        transactions: [],
        has_more: false
      };
    }

    if (!data) {
      console.log('No data received from API');
      return {
        transactions: [],
        has_more: false
      };
    }

    // Use the TransactionSerializer to process the response
    return TransactionSerializer.serializeTransactionsResponse(data);
  }

  /**
   * Claims tokens from the faucet
   */
  public static async faucetClaim(): Promise<void> {
    try {
      // Use the environment variable but fallback to the actual deployed canister ID if needed
      // The correct ID is be2us-64aaa-aaaaa-qaabq-cai, not ohr23-xqaaa-aaaar-qahqq-cai
      const faucetCanisterId = "be2us-64aaa-aaaaa-qaabq-cai"; // Hardcoded as fallback
      
      console.debug(`[Faucet] Using canister ID: ${faucetCanisterId} (env: ${process.env.CANISTER_ID_KONG_FAUCET})`);
      
      const actor = auth.pnp.getActor(
        faucetCanisterId, // Use the hardcoded ID instead of process.env
        canisterIDLs.kong_faucet,
        { anon: false, requiresSigning: false },
      );
      
      console.debug("[Faucet] Calling claim method");
      const result = await actor.claim();

      if ('Ok' in result) {
        console.debug("[Faucet] Claim successful:", result.Ok);
        toastStore.success("Tokens minted successfully");
      } else {
        console.error("[Faucet] Error minting tokens:", result.Err);
        toastStore.error(`Error minting tokens: ${result.Err}`);
      }
    } catch (error) {
      console.error("[Faucet] Exception during claim:", error);
      toastStore.error(`Claim failed: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Fetches token metadata from a canister
   */
  public static async fetchTokenMetadata(canisterId: string): Promise<FE.Token | null> {
    try {
      const actor = await createAnonymousActorHelper(canisterId, canisterIDLs.icrc2);
      if (!actor) {
        throw new Error('Failed to create token actor');
      }

      // Fetch token data from the canister
      const tokenData = await this.fetchTokenDataFromCanister(actor);
      const tokens = get(userTokens).tokens;
      const tokenId = tokens.length + 1000;

      // Create raw token data
      const rawTokenData = this.createRawTokenData(canisterId, tokenData, tokenId);

      // Use the TokenSerializer to process the token data
      return TokenSerializer.serializeTokenMetadata(rawTokenData);
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      toastStore.error('Error fetching token metadata');
      return null;
    }
  }

  /**
   * Fetches token data from a canister
   * @private
   */
  private static async fetchTokenDataFromCanister(actor: any): Promise<any> {
    const [name, symbol, decimals, fee, supportedStandards, metadata, totalSupply] = await Promise.all([
      actor.icrc1_name(),
      actor.icrc1_symbol(),
      actor.icrc1_decimals(),
      actor.icrc1_fee(),
      actor.icrc1_supported_standards(),
      actor.icrc1_metadata(),
      actor.icrc1_total_supply()
    ]);

    return { name, symbol, decimals, fee, supportedStandards, metadata, totalSupply };
  }

  /**
   * Creates raw token data object
   * @private
   */
  private static createRawTokenData(canisterId: string, tokenData: any, tokenId: number): any {
    const { name, symbol, decimals, fee, supportedStandards, metadata, totalSupply } = tokenData;

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
      logo_url: TokenSerializer.extractLogoFromMetadata(metadata as Array<[string, any]>),
      token_type: "IC",
      token_id: tokenId,
      chain: "IC",
      total_24h_volume: "0"
    };
  }
}
