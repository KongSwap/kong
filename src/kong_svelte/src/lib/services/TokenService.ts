import { getActor } from '$lib/stores/walletStore';
import { isConnected } from '$lib/stores/walletStore';
import { PoolService } from './PoolService';
import { formatUSD, formatTokenAmount } from '$lib/utils/formatNumberCustom';
import { walletStore } from '$lib/stores/walletStore';
import { get } from 'svelte/store';

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
    return result.Ok
      .filter(token => 'IC' in token)
      .map(token => token.IC);
  }

  public static async enrichTokenWithMetadata(token: FE.Token): Promise<FE.Token> {
    return {
      ...token,
      logo: await this.fetchTokenLogo(token.canister_id),
    };
  }

  public static async fetchBalances(tokens: FE.Token[], principalId: string = null): Promise<Record<string, FE.TokenBalance>> {
    let wallet;
    const isWalletConnected = isConnected();
    if (!isWalletConnected) return {};

    if (!principalId) {
      wallet = get(walletStore);
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
        const price = await this.fetchPrice(token.canister_id);
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

  public static async fetchPrices(tokens: FE.Token[]): Promise<Record<string, number>> {
    let poolData = await PoolService.fetchPoolsData();
    return tokens.reduce((acc, token) => {
      acc[token.canister_id] = poolData.pools.find(pool => pool.address_0 === token.canister_id && pool.symbol_1 === "ckUSDT")?.price || 0;
      return acc;
    }, {});
  }

  public static async fetchPrice(canisterId: string): Promise<number> {
    let poolData = await PoolService.fetchPoolsData();
    return poolData.pools.find(pool => pool.address_0 === canisterId && pool.symbol_1 === "ckUSDT")?.price || 0;
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

  public static async fetchTokenLogo(canisterId: any): Promise<any> {
    try {
      const actor = await getActor(canisterId, 'icrc1');
      const res = await actor.icrc1_metadata();
      const filtered = res.filter((arr: any[]) => {
        if (arr[0] === 'icrc1:logo' || arr[0] === 'icrc1_logo') {
          return arr[1];
        }
      });
      if (filtered.length > 0) {
        return filtered[0][1].Text;
      }
      return null;
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', error);
    }
  }

  public static async claimFaucetTokens(): Promise<void> {
    try {
      const kongFaucetId = process.env.CANISTER_ID_KONG_FAUCET;
      const actor = await getActor(kongFaucetId, 'kong_faucet');
      const res = await actor.claim();
      console.log('Faucet tokens claimed', res);
    } catch (error) {
      console.error('Error claiming faucet tokens:', error);
    }
  }
} 
