import { getActor } from '$lib/stores/walletStore';
import { UserService } from './UserService';
import { Principal } from '@dfinity/principal';
import { isConnected } from '$lib/stores/walletStore';

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
      logo: await this.getTokenLogo(token.canister_id),
      user_balance: BigInt(0)
    };
  }

  public static async fetchBalances(tokens: FE.Token[]): Promise<Record<string, bigint>> {
    const isWalletConnected = await isConnected();
    if (!isWalletConnected) return {};

    const wallet = await UserService.getWhoami();
    if (!wallet) return {};

    const balances: Record<string, bigint> = {};
    
    for (const token of tokens) {
      try {
        const actor = await getActor(token.canister_id, 'icrc1');
        const owner = Principal.fromText(wallet.principal_id);
        const balance = await actor.icrc1_balance_of({
          owner,
          subaccount: [],
        });
        balances[token.canister_id] = balance || BigInt(0);
      } catch (err) {
        console.error(`Error fetching balance for ${token.canister_id}:`, err);
        balances[token.canister_id] = BigInt(0);
      }
    }
    
    return balances;
  }

  public static async fetchPrices(tokens: FE.Token[]): Promise<Record<string, number>> {
    // In the future, this could fetch real prices from an API
    return tokens.reduce((acc, token) => ({
      ...acc,
      [token.canister_id]: 1
    }), {});
  }

  public static getLogo(canisterId: string): Promise<string | null> {
    return null;
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

  public static async getTokenLogo(canisterId: any): Promise<any> {
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
      console.log('kongFaucetId', kongFaucetId);
      const actor = await getActor(kongFaucetId, 'kong_faucet');
      console.log('actor', actor);
      const res = await actor.claim();
      console.log('Faucet tokens claimed', res);
    } catch (error) {
      console.error('Error claiming faucet tokens:', error);
    }
  }
} 