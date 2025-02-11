// TokenService.ts
import { auth, canisterIDLs } from "$lib/services/auth";
import {
  formatToNonZeroDecimal,
  formatBalance,
} from "$lib/utils/numberFormatUtils";
import { get } from "svelte/store";
import {
  INDEXER_URL,
} from "$lib/constants/canisterConstants";
import { Principal } from "@dfinity/principal";
import { IcrcService } from "$lib/services/icrc/IcrcService";
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
    cursor?: number,
    limit: number = 40, 
    tx_type: 'swap' | 'pool' = 'swap'
  ): Promise<{ transactions: any[], has_more: boolean, next_cursor?: number }> {
    try {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
      });

      if (cursor) {
        queryParams.append('cursor', cursor.toString());
      }
      
      // Use different endpoints based on transaction type
      const url = tx_type === 'pool'
        ? `${INDEXER_URL}/api/users/${principalId}/transactions/liquidity?${queryParams.toString()}`
        : `${INDEXER_URL}/api/users/${principalId}/transactions/swap?${queryParams.toString()}`;
      
      const response = await fetch(url);
      const responseText = await response.text();
      
      // If response is empty, return empty result
      if (!responseText.trim()) {
        console.log('Empty response received');
        return {
          transactions: [],
          has_more: false
        };
      }
      
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

      const items = Array.isArray(data.items) ? data.items : 
                   Array.isArray(data) ? data :
                   data.transaction ? [data] : [];

      const transformedTransactions = items.map((item: any) => {        
        const tx = item.transaction || item;
        const tokens = item.tokens || [];
        
        if (!tx) {
          console.log('No transaction data in item:', item);
          return null;
        }
        
        // Handle different transaction types
        if (tx.tx_type === 'RemoveLiquidity' || tx.tx_type === 'AddLiquidity') {
          const rawTx = tx.raw_json?.[`${tx.tx_type}Tx`];
          if (!rawTx) {
            console.error('Invalid transaction data:', tx);
            return null;
          }

          // Find the tokens in the response
          const token0 = tokens.find((t: any) => t.token_id === tokens[0]?.token_id);
          const token1 = tokens.find((t: any) => t.token_id === tokens[1]?.token_id);
          const lpToken = tokens.find((t: any) => t.token_type === 'Lp');

          // Format amounts by removing underscores and adjusting for decimals
          const amount0 = rawTx.amount_0?.replace(/_/g, '') || '0';
          const amount1 = rawTx.amount_1?.replace(/_/g, '') || '0';
          const lpAmount = (tx.tx_type === 'AddLiquidity' 
            ? rawTx.add_lp_token_amount 
            : rawTx.remove_lp_token_amount)?.replace(/_/g, '') || '0';

          // Format amounts based on token decimals
          const formattedAmount0 = token0 
            ? (Number(amount0) / Math.pow(10, token0.decimals)).toString() 
            : amount0;
          const formattedAmount1 = token1 
            ? (Number(amount1) / Math.pow(10, token1.decimals)).toString() 
            : amount1;
          const formattedLpAmount = lpToken 
            ? (Number(lpAmount) / Math.pow(10, lpToken.decimals || 8)).toString() 
            : lpAmount;

          return {
            tx_id: rawTx.tx_id,
            tx_type: tx.tx_type === 'RemoveLiquidity' ? 'remove_liquidity' : 'add_liquidity',
            status: rawTx.status || 'Success',
            timestamp: rawTx.ts.toString(),
            details: {
              token_0_id: token0?.token_id,
              token_1_id: token1?.token_id,
              token_0_symbol: token0?.symbol || `Token ${token0?.token_id}`,
              token_1_symbol: token1?.symbol || `Token ${token1?.token_id}`,
              token_0_canister: token0?.canister_id || '',
              token_1_canister: token1?.canister_id || '',
              amount_0: formattedAmount0,
              amount_1: formattedAmount1,
              lp_token_symbol: lpToken?.symbol || '',
              lp_token_amount: formattedLpAmount,
              pool_id: rawTx.pool_id,
              lp_fee_0: rawTx.lp_fee_0?.replace(/_/g, '') || '0',
              lp_fee_1: rawTx.lp_fee_1?.replace(/_/g, '') || '0'
            }
          };
        } else if (tx.tx_type === 'Swap') {
          const rawTx = tx.raw_json?.SwapTx;
          if (!rawTx) {
            console.error('Invalid swap transaction data:', tx);
            return null;
          }

          // Find the tokens in the response
          const payToken = tokens.find((t: any) => t.token_id === rawTx.pay_token_id);
          const receiveToken = tokens.find((t: any) => t.token_id === rawTx.receive_token_id);

          // Format amounts by removing underscores and adjusting for decimals
          const payAmount = rawTx.pay_amount?.replace(/_/g, '') || '0';
          const receiveAmount = rawTx.receive_amount?.replace(/_/g, '') || '0';

          // Format amounts based on token decimals
          const formattedPayAmount = payToken 
            ? (Number(payAmount) / Math.pow(10, payToken.decimals)).toString() 
            : payAmount;
          const formattedReceiveAmount = receiveToken 
            ? (Number(receiveAmount) / Math.pow(10, receiveToken.decimals)).toString() 
            : receiveAmount;

          return {
            tx_id: rawTx.tx_id,
            tx_type: 'swap',
            status: rawTx.status || 'Success',
            timestamp: rawTx.ts.toString(),
            details: {
              pay_amount: formattedPayAmount,
              receive_amount: formattedReceiveAmount,
              pay_token_id: rawTx.pay_token_id,
              receive_token_id: rawTx.receive_token_id,
              pool_id: rawTx.pool_id,
              price: rawTx.price?.toString() || "0",
              slippage: rawTx.slippage?.toString() || "0",
              pay_token_symbol: payToken?.symbol || `Token ${rawTx.pay_token_id}`,
              receive_token_symbol: receiveToken?.symbol || `Token ${rawTx.receive_token_id}`,
              pay_token_canister: payToken?.canister_id || '',
              receive_token_canister: receiveToken?.canister_id || '',
              gas_fee: (rawTx.gas_fee || '0').replace(/_/g, ''),
              lp_fee: (rawTx.lp_fee || '0').replace(/_/g, '')
            }
          };
        }
        
        return null;
      }).filter(Boolean);

      return {
        transactions: transformedTransactions,
        has_more: data.has_more || false,
        next_cursor: data.next_cursor
      };
    } catch (error) {
      console.error("Error fetching user transactions:", {
        error,
        url: `${INDEXER_URL}/api/users/${principalId}/transactions/${tx_type}`,
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
