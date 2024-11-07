import { getActor } from '$lib/stores/walletStore';
import { PoolService } from '$lib/services/PoolService';
import { formatToNonZeroDecimal, formatTokenAmount } from '$lib/utils/numberFormatUtils';
import { Principal } from '@dfinity/principal';
import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { walletStore } from '$lib/stores/walletStore';
import { get } from 'svelte/store';
import { canisterId as kongBackendCanisterId } from '../../../../../declarations/kong_backend';

export class TokenService {
  constructor(private poolService: PoolService) {}

  // Fetch all tokens from the backend
  static async fetchTokens(type: string = 'all'): Promise<FE.Token[]> {
    const actor = await getActor();
    const result = await actor.tokens(['all']);
    if (result.Ok) {
      return result.Ok.filter(token => token.IC)
    } else {
      throw new Error(result.Err);
    }
  }

  // Enrich a token with additional metadata
  static async enrichTokenWithMetadata(tokens: FE.Token[]): Promise<FE.Token[]> {
    const poolData = get(poolStore);
    
    // Process tokens in parallel batches
    const BATCH_SIZE = 5;
    const enrichedTokens: FE.Token[] = [];
    
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async token => {
        try {
          const [price, volume24h, logo] = await Promise.all([
            this.fetchPrice(token),
            this.calculate24hVolume(token, poolData.pools),
            this.fetchTokenLogo(token)
          ]);
          
          return {
            ...token,
            price,
            total_24h_volume: volume24h,
            logo
          };
        } catch (error) {
          console.error(`Error enriching token ${token.symbol}:`, error);
          return token;
        }
      });
      
      const batchResults = await Promise.all(promises);
      enrichedTokens.push(...batchResults);
    }
    
    return enrichedTokens;
  }

  static async enrichTokenWithEssentialData(token: FE.Token): Promise<FE.Token> {
    return {
      ...token,
      price: 0,
      total_24h_volume: 0n,
      logo: null
    };
  }

  // Fetch balances for a list of tokens
  static async fetchBalances(tokens: FE.Token[], principalId: string = null): Promise<Record<string, FE.TokenBalance>> {
    const wallet = get(walletStore);
    if (!wallet.isConnected) return {};

    const ownerId = principalId || wallet.account.owner;
    
    const balances: Record<string, FE.TokenBalance> = {};
    
    for (const token of tokens) {
      try {
        const actor = await getActor(token.canister_id, 'icrc1');
        const balance = await actor.icrc1_balance_of({
          owner: ownerId,
          subaccount: [],
        });
        
        const actualBalance = formatTokenAmount(balance, token.decimals);
        const price = await this.fetchPrice(token);
        const usdValue = actualBalance * price;

        balances[token.canister_id] = {
          in_tokens: BigInt(balance) || BigInt(0),
          in_usd: formatToNonZeroDecimal(usdValue)
        };
      } catch (err) {
        console.error(`Error fetching balance for ${token.canister_id}:`, token);
        balances[token.canister_id] = { in_tokens: 0n, in_usd: formatToNonZeroDecimal(0) };
      }
    }
    
    return balances;
  }

  // Fetch a single token's balance
  static async fetchBalance(principalId: string, token: string): Promise<string> {
    const tokens = await this.fetchTokens();
    const canisterId = tokens.find(t => t.symbol === token)?.canister_id;
    const actor = await getActor(canisterId, 'icrc1');
    const balance = await actor.icrc1_balance_of({
      owner: principalId,
      subaccount: [],
    });
    return balance;
  }

  // Fetch prices for a list of tokens
  static async fetchPrices(tokens: FE.Token[]): Promise<Record<string, number>> {
    const poolData = await PoolService.fetchPoolsData();
    const prices: Record<string, number> = {};

    for (const token of tokens) {
      // Find a direct USDT pair
      const usdtPool = poolData.pools.find(pool => 
        (pool.address_0 === token.canister_id && pool.symbol_1 === "ckUSDT") ||
        (pool.address_1 === token.canister_id && pool.symbol_0 === "ckUSDT")
      );

      if (usdtPool) {
        prices[token.canister_id] = usdtPool.price;
      } else {
        // If no direct USDT pair, try through ICP
        const icpPool = poolData.pools.find(pool => 
          (pool.address_0 === token.canister_id && pool.symbol_1 === "ICP") ||
          (pool.address_1 === token.canister_id && pool.symbol_0 === "ICP")
        );

        if (icpPool) {
          const icpUsdtPrice = await this.getUsdtPriceForToken("ICP", poolData.pools);
          prices[token.canister_id] = icpUsdtPrice * icpPool.price;
        } else {
          prices[token.canister_id] = 0; // Default to 0 if no price can be determined
        }
      }
    }

    return prices;
  }

  // Fetch price for a single token
  static async fetchPrice(token: FE.Token): Promise<number> {
    const poolData = await PoolService.fetchPoolsData(); // Assume a synchronous method; adjust if async
    // Get all pools where the token is present
    const relevantPools = poolData.pools.filter(pool => 
      pool.address_0 === token.canister_id || 
      pool.address_1 === token.canister_id
    );

    if (relevantPools.length === 0) return 0;

    let totalWeight = 0n;
    let weightedPrice = 0;

    for (const pool of relevantPools) {
      let price: number;
      let weight: bigint;

      if (pool.address_0 === token.canister_id) {
        if (pool.symbol_1 === "ICP") {
          const icpPrice = await this.getUsdtPriceForToken("ICP", poolData.pools);
          const usdtPrice = pool.price * icpPrice;
          price = usdtPrice;
        } else {
          price = pool.price * (await this.getUsdtPriceForToken(pool.symbol_1, poolData.pools));
        }
      } else if (pool.address_1 === token.canister_id) {
        if (pool.symbol_0 === "ICP") {
          const icpPrice = await this.getUsdtPriceForToken("ICP", poolData.pools);
          const usdtPrice = pool.price * icpPrice;
          price = usdtPrice;
        } else {
          price = pool.price * (await this.getUsdtPriceForToken(pool.symbol_0, poolData.pools));
        }
      } else {
        price = 0;
      }

      weight = pool.rolling_24h_volume || 0n;
      totalWeight += weight;
      weightedPrice += price * Number(pool.rolling_24h_volume || 0n);
    }

    return totalWeight > 0n ? weightedPrice / Number(totalWeight) : 0;
  }

  // Retrieves the USDT price for a given token symbol via ICP
  static async getUsdtPriceViaICP(symbol: string, pools: BE.Pool[]): Promise<number> {
    // Find a pool with the token and ICP
    const tokenIcpPool = pools.find(
      (p) =>
        (p.symbol_0 === symbol && p.symbol_1 === 'ICP') ||
        (p.symbol_1 === symbol && p.symbol_0 === 'ICP')
    );

    // Find the ICP to USDT pool
    const icpUsdtPool = pools.find(
      (p) =>
        (p.symbol_0 === 'ICP' && p.symbol_1 === 'ckUSDT') ||
        (p.symbol_1 === 'ICP' && p.symbol_0 === 'ckUSDT')
    );

    if (tokenIcpPool && icpUsdtPool) {
      const tokenPriceInIcp =
        tokenIcpPool.symbol_1 === 'ICP'
          ? tokenIcpPool.price
          : 1 / tokenIcpPool.price;

      const icpPriceInUsdt =
        icpUsdtPool.symbol_1 === 'ckUSDT'
          ? icpUsdtPool.price
          : 1 / icpUsdtPool.price;

      const combinedPrice = tokenPriceInIcp * icpPriceInUsdt;
      return combinedPrice;
    }

    return 0;
  }

  // Fetch token metadata (like logo)
  static async fetchTokenMetadata(token: FE.Token): Promise<any> {
    try {
      const actor = await getActor(token.canister_id, 'icrc1');
      return await actor.icrc1_metadata();
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', error);
      throw error;
    }
  }

    // Get USDT price for a given token symbol
    static async getUsdtPriceForToken(symbol: string, pools: BE.Pool[]): Promise<number> {
      // Find a direct USDT pair for the token
      const usdtPool = pools.find(
        (p) =>
          (p.symbol_0 === symbol && p.symbol_1 === 'ckUSDT') ||
          (p.symbol_1 === symbol && p.symbol_0 === 'ckUSDT')
      );
  
      if (usdtPool) {
        const price =
          usdtPool.symbol_1 === 'ckUSDT'
            ? usdtPool.price
            : 1 / usdtPool.price;
        return price;
      }
  
      // If no direct USDT pair, attempt to get price via ICP
      const icpPrice = await this.getUsdtPriceViaICP(symbol, pools);
      if (icpPrice > 0) {
        return icpPrice;
      }
  
      console.warn(`Unable to determine USDT price for token: ${symbol}`);
      return 0;
    }
  

  // Fetch token logo
  static async fetchTokenLogo(token: FE.Token): Promise<string> {
    // Check cache first
    if (this.logoCache.has(token.canister_id)) {
      return this.logoCache.get(token.canister_id);
    }

    try {
      const actor = await getActor(token.canister_id, 'icrc1');
      const res = await actor.icrc1_metadata();
      const logoEntry = res.find(
        ([key]) => key === 'icrc1:logo' || key === 'icrc1_logo'
      );

      let logo = '';
      if (logoEntry && logoEntry[1]?.Text) {
        logo = logoEntry[1].Text;
      } else {
        logo = this.DEFAULT_LOGOS[token.canister_id] || this.DEFAULT_LOGOS.DEFAULT;
      }

      // Cache the result
      this.logoCache.set(token.canister_id, logo);
      return logo;
    } catch (error) {
      console.error('Error fetching token logo:', error);
      const defaultLogo = this.DEFAULT_LOGOS[token.canister_id] || this.DEFAULT_LOGOS.DEFAULT;
      this.logoCache.set(token.canister_id, defaultLogo);
      return defaultLogo;
    }
  }

  // Fetch user transactions
  static async fetchUserTransactions(principalId: string, tokenId = ""): Promise<any> {
    const actor = await getActor();
    return await actor.txs([true]);
  }

  // Claim faucet tokens
  static async claimFaucetTokens(): Promise<void> {
    try {
      const kongFaucetId = import.meta.env.VITE_CANISTER_ID_KONG_FAUCET;
      const actor = await getActor(kongFaucetId, 'kong_faucet');
      const res = await actor.claim();
      // Note: Reloading tokens and balances should be handled by the store to avoid circular dependencies
    } catch (error) {
      console.error('Error claiming faucet tokens:', error);
      throw error; // Rethrow to allow the store to handle it
    }
  }

  // Calculate total 24-hour volume for a token
  static async calculate24hVolume(token: FE.Token, pools: BE.Pool[]): Promise<bigint> {
    let total24hVolume = 0n;

    pools.forEach(pool => {
      // Check if the token is part of the pool
      if (pool.address_0 === token.canister_id || pool.address_1 === token.canister_id) {
        // Add the rolling 24h volume of the pool to the total
        if (pool.rolling_24h_volume) {
          total24hVolume += pool.rolling_24h_volume;
        }
      }
    });

    return total24hVolume;
  }

  // Request ICRC2 approval for token spending
  static async requestIcrc2Approve(
    canisterId: string, 
    payAmount: bigint,
    gasAmount: bigint = BigInt(0)
  ): Promise<boolean> {
    try {
      const actor = await getActor(canisterId, 'icrc2');

      if (!actor.icrc2_approve) {
        throw new Error('ICRC2 methods not available - wrong IDL loaded');
      }

      const expiresAt = BigInt(Date.now()) * BigInt(1_000_000) + BigInt(60_000_000_000);
      
      // Keep it as BigInt
      const totalAmount = payAmount + gasAmount;
      console.log("totalAmount", totalAmount);
      
      const approveArgs = {
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: BigInt(totalAmount),  // Pass as BigInt
        expected_allowance: [],
        expires_at: [expiresAt],
        spender: { 
          owner: Principal.fromText(kongBackendCanisterId), 
          subaccount: [] 
        }
      };

      const result = await actor.icrc2_approve(approveArgs);
      
      if ('Err' in result) {
        throw new Error(`ICRC2 approve error: ${JSON.stringify(result.Err)}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error in ICRC2 approve:', error);
      throw error;
    }
  }

  // Check ICRC2 allowance for a specific spender
  static async checkIcrc2Allowance(
    canisterId: string,
    owner: string
  ): Promise<bigint> {
    try {
      // Explicitly request ICRC2 actor
      const actor = await getActor(canisterId, 'icrc2');

      if (!actor.icrc2_allowance) {
        throw new Error('ICRC2 methods not available - wrong IDL loaded');
      }

      const result = await actor.icrc2_allowance({
        account: { owner, subaccount: [] },
        spender: { 
          owner, 
          subaccount: [] 
        }
      });

      return BigInt(result.allowance);
    } catch (error) {
      console.error('Error checking ICRC2 allowance:', error);
      throw error; // Let's throw the error to better handle the failure
    }
  }
}