import { getActor } from '$lib/stores/walletStore';
import { PoolService } from './PoolService';
import { formatUSD, formatTokenAmount } from '$lib/utils/numberFormatUtils';
import { walletStore } from '$lib/stores/walletStore';
import { get } from 'svelte/store';
import { tokenStore } from '$lib/stores/tokenStore';
import { ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { poolStore } from '$lib/stores/poolStore';
export class TokenService {
  protected static instance: TokenService;

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  public static async fetchTokens(): Promise<FE.Token[]> {
    const actor = await getActor();
    const result = await actor.tokens(['all']);
    if (!result.Ok) return [];
    const enrichedTokens = await Promise.all(result.Ok.map(token => this.enrichTokenWithMetadata(token)));
    return enrichedTokens
      .filter(token => 'IC' in token)
      .map(token => token.IC);
  }

  public static async enrichTokenWithMetadata(token: FE.Token): Promise<FE.Token> {
    const poolData = get(poolStore);
    const price = await this.fetchPrice(token);
    const volume24h = this.calculate24hVolume(token, poolData.pools);
    
    return {
        ...token,
        price,
        total_24h_volume: volume24h,
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
          in_usd: formatUSD(usdValue)
        }
      } catch (err) {
        console.error(`Error fetching balance for ${token.canister_id}:`, err);
        balances[token.canister_id] = {in_tokens: 0n, in_usd: formatUSD(0)}
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
    let poolData = await PoolService.fetchPoolsData();
    return tokens.reduce((acc, token) => {
      acc[token.canister_id] = poolData.pools.find(pool => pool.address_0 === token.canister_id && pool.symbol_1 === "ckUSDT")?.price || 0;
      return acc;
    }, {});
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

        // Special handling for ckUSDT
        if (token.symbol === "ckUSDT") {
            // Only use stablecoin pairs for ckUSDT price
            if (pool.symbol_0 === "ckUSDC" || pool.symbol_1 === "ckUSDC") {
                // If ckUSDT is symbol_1, use price directly; if it's symbol_0, use 1/price
                price = pool.address_1 === token.canister_id ? pool.price : 1 / pool.price;
                weight = pool.address_1 === token.canister_id ? pool.balance_1 : pool.balance_0;
                
                // Log for debugging
                console.log(`ckUSDT-USDC pair - Price: ${price}, Weight: ${weight}`);
            } else {
                // Skip non-stablecoin pairs for ckUSDT
                continue;
            }
        } else {
            // Regular token price calculation (unchanged)
            if (pool.address_0 === token.canister_id) {
                price = pool.symbol_1 === "ckUSDT" ? 
                    pool.price : 
                    pool.price * (await this.getUsdtPriceForToken(pool.symbol_1, poolData.pools));
                weight = pool.balance_0;
            } else {
                price = pool.symbol_0 === "ckUSDT" ? 
                    1 / pool.price : 
                    (1 / pool.price) * (await this.getUsdtPriceForToken(pool.symbol_0, poolData.pools));
                weight = pool.balance_1;
            }
        }

        if (price > 0 && weight > 0n) {
            weightedPrice += Number(weight) * price;
            totalWeight += weight;
        }
    }

    // For ckUSDT, if no valid pairs found, return 1 as fallback
    if (token.symbol === "ckUSDT" && totalWeight === 0n) {
        return 1;
    }

    return totalWeight > 0n ? weightedPrice / Number(totalWeight) : 0;
  }

  private static async getUsdtPriceForToken(symbol: string, pools: BE.Pool[]): Promise<number> {
    // Find direct USDT pair for the token
    const usdtPool = pools.find(p => 
        (p.symbol_0 === symbol && p.symbol_1 === "ckUSDT") ||
        (p.symbol_1 === symbol && p.symbol_0 === "ckUSDT")
    );

    if (usdtPool) {
        return usdtPool.symbol_1 === "ckUSDT" ? usdtPool.price : 1 / usdtPool.price;
    }

    // If no direct USDT pair, try through ICP
    const icpPool = pools.find(p => 
        (p.symbol_0 === symbol && p.symbol_1 === "ICP") ||
        (p.symbol_1 === symbol && p.symbol_0 === "ICP")
    );

    const icpUsdtPool = pools.find(p => 
        (p.symbol_0 === "ICP" && p.symbol_1 === "ckUSDT") ||
        (p.symbol_1 === "ICP" && p.symbol_0 === "ckUSDT")
    );

    if (icpPool && icpUsdtPool) {
        const icpPrice = icpPool.symbol_1 === "ICP" ? icpPool.price : 1 / icpPool.price;
        const icpUsdtPrice = icpUsdtPool.symbol_1 === "ckUSDT" ? icpUsdtPool.price : 1 / icpUsdtPool.price;
        return icpPrice * icpUsdtPrice;
    }

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
        return '/tokens/icp.png';
      } else {
        return '/tokens/not_verified.webp';
      }
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', error);

      if (token.canister_id === ICP_CANISTER_ID) {
        return '/tokens/icp.png';
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
      await Promise.all([tokenStore.loadTokens(), poolStore.loadPools()]);
      console.log('Faucet tokens claimed', res);
    } catch (error) {
      console.error('Error claiming faucet tokens:', error);
    }
  }

  private static calculate24hVolume(token: FE.Token, pools: BE.Pool[]): number {
    // Get all pools where the token is present
    const relevantPools = pools.filter(pool => 
        pool.address_0 === token.canister_id || 
        pool.address_1 === token.canister_id
    );

    if (relevantPools.length === 0) return 0;

    // Add debug logging
    console.log(`Calculating volume for ${token.symbol}:`, relevantPools);

    // Sum up the 24h volume from all pools
    const total24hVolume = relevantPools.reduce((total, pool) => {
        // Debug logging for each pool
        console.log("Pool", pool);

        // Convert BigInt to number safely
        const volume = Number(pool.total_volume) / 1e6;
        
        if (volume <= 0) return total;

        // If token is in address_1 position, convert the volume using the pool price
        if (pool.address_1 === token.canister_id) {
            const volumeInUsd = volume * pool.price;
            console.log(`Volume in USD (address_1): ${volumeInUsd}`);
            return total + volumeInUsd;
        } else {
            console.log(`Volume in USD (address_0): ${volume}`);
            return total + volume;
        }
    }, 0);

    console.log(`Total 24h volume for ${token.symbol}: ${total24hVolume}`);
    return total24hVolume;
  }
} 
