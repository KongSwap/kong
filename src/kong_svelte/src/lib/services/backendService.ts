// services/backendService.ts
import { getActor } from '$lib/stores/walletStore';
import { walletValidator } from '$lib/validators/walletValidator';
import type { Token, Pool, User, SwapQuoteResponse, SwapAsyncResponse, RequestResponse, PoolResponse } from '$lib/types/backend';
import type { Principal } from '@dfinity/principal';

class BackendService {
  private static instance: BackendService;
  private constructor() {}

  public static getInstance(): BackendService {
    if (!BackendService.instance) {
      BackendService.instance = new BackendService();
    }
    return BackendService.instance;
  }

  // Token Related Methods
  public async getTokens(): Promise<Token[]> {
    try {
      const actor = await getActor();
      const result = await actor.tokens(['all']);
      
      if (result.Ok) {
        return result.Ok.filter(token => 'IC' in token).map(token => {
          return {
            fee: token.IC.fee,
            decimals: token.IC.decimals,
            token: token.IC.token,
            tokenId: token.IC.token_id,
            chain: token.IC.chain,
            name: token.IC.name,
            canisterId: token.IC.canister_id,
            icrc1: token.IC.icrc1,
            icrc2: token.IC.icrc2,
            icrc3: token.IC.icrc3,
            poolSymbol: token.IC.pool_symbol,
            symbol: token.IC.symbol,
            onKong: token.IC.on_kong
          };
        });
      }
      return [];
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw error;
    }
  }

  public async getUserBalances(principal: Principal): Promise<Record<string, any>> {
    try {
      await walletValidator.requireWalletConnection();
      const actor = await getActor();
      const result = await actor.user_balances(['']);
      if (result.Ok) {
        const balances: Record<string, any> = {};
        result.Ok.forEach((lpToken) => {
          if ('LP' in lpToken) {
            const lp = lpToken.LP;
            balances[lp.symbol] = {
              balance: lp.balance,
              usdBalance: lp.usd_balance,
              token0Amount: lp.amount_0,
              token1Amount: lp.amount_1,
              token0Symbol: lp.symbol_0,
              token1Symbol: lp.symbol_1,
              token0UsdAmount: lp.usd_amount_0,
              token1UsdAmount: lp.usd_amount_1,
              timestamp: lp.ts
            };
          }
        });
        return balances;
      }
      return {};
    } catch (error) {
      console.error('Error getting user balances:', error);
      throw error;
    }
  }
  
  public async getTokenPrices(): Promise<Record<string, number>> {
    try {
        const actor = await getActor();
        // Use the correct token symbols
        const defaultPrices = {
            "ICP": 1,
            "ckBTC": 1,
            "ckETH": 1,
            "ckUSDC": 1,
            "ckUSDT": 1,
        };
        return defaultPrices;
    } catch (error) {
        console.error('Error getting token prices:', error);
        throw error;
    }
}

  // User Related Methods
  public async getWhoami(): Promise<User> {
    await walletValidator.requireWalletConnection();
    try {
      const actor = await getActor();
      return await actor.get_user();
    } catch (error) {
      console.error('Error calling get_user method:', error);
      throw error;
    }
  }

  // Token Related Methods
  public async getTokenLogo(canisterId: string): Promise<void> {
    try {
      const actor = await getActor();
    } catch (error) {
      console.error('Error calling get_user method:', error);
      throw error;
    }
  }

  // Pool Related Methods
  public async getPools(): Promise<PoolResponse> {
    try {
      const actor = await getActor();
      const result = await actor.pools([]);
      if (result.Ok) {
        return result.Ok;
      }
      return { pools: [], total_tvl: 0, total_24h_volume: 0, total_24h_lp_fee: 0 };
    } catch (error) {
      console.error('Error calling pools method:', error);
      throw error;
    }
  }

  public async getPoolInfo(poolId: string): Promise<Pool> {
    try {
      const actor = await getActor();
      return await actor.get_by_pool_id(poolId);
    } catch (error) {
      console.error('Error getting pool info:', error);
      throw error;
    }
  }

  // Swap Related Methods
  public async swap_amounts(payToken: string, payAmount: bigint, receiveToken: string): Promise<SwapQuoteResponse> {
    try {
      const actor = await getActor();
      return await actor.swap_amounts(payToken, payAmount, receiveToken);
    } catch (error) {
      console.error('Error getting swap amounts:', error);
      throw error;
    }
  }

  public async swap_async(params: {
    pay_token: string;
    pay_amount: bigint;
    receive_token: string;
    receive_amount: bigint[];
    max_slippage: number[];
    receive_address?: string[];
    referred_by?: string[];
    pay_tx_id?: string[];
  }): Promise<SwapAsyncResponse> {
    try {
      const actor = await getActor();
      return await actor.swap_async(params);
    } catch (error) {
      console.error('Error executing swap:', error);
      throw error;
    }
  }

  public async requests(requestIds: bigint[]): Promise<RequestResponse> {
    try {
      const actor = await getActor();
      return await actor.requests(requestIds);
    } catch (error) {
      console.error('Error getting request status:', error);
      throw error;
    }
  }

  // Liquidity Related Methods
  public async addLiquidity(params: {
    token0: string;
    amount0: bigint;
    token1: string;
    amount1: bigint;
  }): Promise<{ requestId: string }> {
    await walletValidator.requireWalletConnection();
    try {
      const actor = await getActor();
      const result = await actor.add_liquidity_async({
        token_0: params.token0,
        amount_0: params.amount0,
        token_1: params.token1,
        amount_1: params.amount1,
        tx_id_0: [],
        tx_id_1: []
      });
      return { requestId: result.Ok };
    } catch (error) {
      console.error('Error adding liquidity:', error);
      throw error;
    }
  }

  public async removeLiquidity(params: {
    token0: string;
    token1: string;
    lpTokenAmount: bigint;
  }): Promise<{ requestId: string }> {
    await walletValidator.requireWalletConnection();
    try {
      const actor = await getActor();
      const result = await actor.remove_liquidity_async({
        token_0: params.token0,
        token_1: params.token1,
        remove_lp_token_amount: params.lpTokenAmount
      });
      return { requestId: result.Ok };
    } catch (error) {
      console.error('Error removing liquidity:', error);
      throw error;
    }
  }

  // Transaction Related Methods
  public async getTransactionHistory(principal: Principal): Promise<any[]> {
    try {
      const actor = await getActor();
      const result = await actor.txs([true]);
      return result.Ok || [];
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }

  public async getTransactionStatus(requestId: string): Promise<any> {
    try {
      const actor = await getActor();
      const result = await actor.requests([requestId]);
      return result.Ok?.[0];
    } catch (error) {
      console.error('Error getting transaction status:', error);
      throw error;
    }
  }

  // Token Approval Methods
  public async approveToken(params: {
    token: string;
    amount: bigint;
    spender: Principal;
  }): Promise<boolean> {
    await walletValidator.requireWalletConnection();
    try {
      const actor = await getActor();
      const result = await actor.icrc2_approve({
        amount: params.amount,
        spender: { owner: params.spender, subaccount: [] },
        expires_at: [BigInt(Date.now() * 1000000 + 60000000000)],
        expected_allowance: [],
        memo: [],
        fee: [],
        created_at_time: []
      });
      return !!result.Ok;
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    }
  }

  public async getIcrc1TokenMetadata(canisterId: string): Promise<any> {
    try {
      const actor = await getActor(canisterId, 'icrc1');
      return await actor.icrc1_metadata();
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', error);
      throw error;
    }
  }

  public async getIcrcLogFromMetadata(canisterId: any): Promise<any> {
    try {
      const actor = await getActor(canisterId, 'icrc1');
      const res = await actor.icrc1_metadata();
      const filtered = res.filter((arr: any[]) => {
        if (arr[0] === 'icrc1:logo' || arr[0] === 'icrc1_logo') {
          return arr[1];
        }
      });
      return filtered[0][1].Text
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', error);
      throw error;
    }
  }
}

export const backendService = BackendService.getInstance();
