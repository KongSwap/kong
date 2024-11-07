import { getActor } from '$lib/stores/walletStore';
import { PoolService } from './PoolService';
import { formatToNonZeroDecimal, formatTokenAmount, parseTokenAmount } from '$lib/utils/numberFormatUtils';
import { walletStore } from '$lib/stores/walletStore';
import { get } from 'svelte/store';
import { tokenStore } from '$lib/stores/tokenStore';
import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { poolStore } from '$lib/stores/poolStore';
import { canisterId as kongBackendCanisterId } from '../../../../declarations/kong_backend';
import { Principal } from '@dfinity/principal';

export class TokenService {
  protected static instance: TokenService;

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  public static async fetchTokens(): Promise<BE.Token[]> {
    const actor = await getActor();
    const result = await actor.tokens(['all']);
    return result.Ok;
  }

  public static async enrichTokenWithMetadata(token: FE.Token): Promise<FE.Token> {
    const poolData = get(poolStore);
    const price = await this.fetchPrice(token);
    const volume24h = this.calculate24hVolume(token, poolData.pools);
    
    return {
        ...token,
        price,
        total_24h_volume: await volume24h,
        logo: await this.fetchTokenLogo(token),
    };
  }

  public static async fetchBalances(tokens: FE.Token[], principalId: string = null): Promise<Record<string, FE.TokenBalance>> {
    const wallet = get(walletStore);
    if (!wallet.isConnected) return {};

    if (!principalId) {
      principalId = wallet.account.owner;
    }
    
    const balances: Record<string, FE.TokenBalance> = {};
    
    for (const token of tokens) {
      try {
        const actor = await getActor(token.canister_id, 'icrc1');
        const owner = wallet.account.owner;
        const balance = await actor.icrc1_balance_of({
          owner,
          subaccount: [],
        });
        
        const actualBalance = formatTokenAmount(balance, token.decimals);
        const price = await this.fetchPrice(token);
        const usdValue = actualBalance * price;

        balances[token.canister_id] = {
          in_tokens: BigInt(balance) || BigInt(0),
          in_usd: formatToNonZeroDecimal(usdValue)
        }
      } catch (err) {
        console.error(`Error fetching balance for ${token.canister_id}:`, token);
        balances[token.canister_id] = {in_tokens: 0n, in_usd: formatToNonZeroDecimal(0)}
      }
    }
    
    return balances;
  }

  public static async fetchBalance(principalId: string, token: string): Promise<string> {
    const tokens = get(tokenStore);
    const canisterId = tokens.tokens.find(t => t.symbol === token)?.canister_id;
    const actor = await getActor(canisterId, 'icrc1');
    const balance = actor.icrc1_balance_of({
      owner: principalId,
      subaccount: [],
    });
    return balance;
  }

  public static async fetchPrices(tokens: FE.Token[]): Promise<Record<string, number>> {
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
          (pool.address_0 === token.canister_id && pool.symbol_1 === "ICP")
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

  public static async fetchPrice(token: FE.Token): Promise<number> {
    const poolData = get(poolStore);
    
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
            weight = pool.balance_0;
        } else {
            if (pool.symbol_0 === "ckUSDT") {
                price = 1 / pool.price;
            } else {
                price = (1 / pool.price) * (await this.getUsdtPriceForToken(pool.symbol_0, poolData.pools));
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

  private static async getUsdtPriceForToken(symbol: string, pools: BE.Pool[]): Promise<number> {
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

  /**
   * Retrieves the USDT price for a given token symbol via ICP.
   * @param symbol The symbol of the token.
   * @param pools The list of all pools.
   * @returns The price of the token in USDT.
   */
  private static async getUsdtPriceViaICP(symbol: string, pools: BE.Pool[]): Promise<number> {
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

    console.warn(`No ICP pools found for token: ${symbol}`);
    return 0;
  }

  public static async getIcrc1TokenMetadata(canisterId: string): Promise<any> {
    try {
      const actor = await getActor(canisterId, 'icrc1');
      return await actor.icrc1_metadata();
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', error);
      throw error;
    }
  }

  public static async fetchTokenLogo(token: FE.Token): Promise<string> {
    try {
      const actor = await getActor(token.canister_id, 'icrc1');
      const res = await actor.icrc1_metadata();
      const logoEntry = res.find(
        ([key]) => key === 'icrc1:logo' || key === 'icrc1_logo'
      );

      if (logoEntry && logoEntry[1]?.Text) {
        return logoEntry[1].Text;
      }

      if (token.canister_id === ICP_CANISTER_ID) {
        return '/tokens/icp.webp';
      } else {
        return '/tokens/not_verified.webp';
      }
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', token);

      if (token.canister_id === ICP_CANISTER_ID) {
        return '/tokens/icp.webp';
      } else {
        return '/tokens/not_verified.webp';
      }
    }
  }

  public static async fetchUserTransactions(principalId: string, tokenId = ""): Promise<any> {
    const actor = await getActor();
    return await actor.txs([true]);
  }

  public static async claimFaucetTokens(): Promise<void> {
    try {
      const kongFaucetId = process.env.CANISTER_ID_KONG_FAUCET;
      const actor = await getActor(kongFaucetId, 'kong_faucet');
      const res = await actor.claim();
      // TODO: Refresh tokens and lps
      await Promise.all([tokenStore.loadTokens(), poolStore.loadPools(), tokenStore.loadBalances()]);
    } catch (error) {
      console.error('Error claiming faucet tokens:', error);
    }
  }

  /**
   * Calculates the total 24-hour volume for a given token across all relevant pools.
   * @param token The token for which to calculate the volume.
   * @param pools The list of all pools.
   * @returns The total 24-hour volume in USD.
   */
  private static async calculate24hVolume(token: FE.Token, pools: BE.Pool[]): Promise<bigint> {
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

  /**
   * Request ICRC2 approval for token spending
   */
  public static async requestIcrc2Approve(
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

  /**
   * Check ICRC2 allowance for a specific spender
   */
  public static async checkIcrc2Allowance(
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
