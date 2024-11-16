// services/PoolService.ts
import { getActor, walletStore } from '$lib/services/wallet/walletStore';
import { walletValidator } from '$lib/services/wallet/walletValidator';
import { get } from 'svelte/store';
import { PoolResponseSchema, UserPoolBalanceSchema } from './poolSchema';
import { IcrcService } from '../icrc/IcrcService';

export class PoolService {
  protected static instance: PoolService;

  public static getInstance(): PoolService {
    if (!PoolService.instance) {
      PoolService.instance = new PoolService();
    }
    return PoolService.instance;
  }

  // Data Fetching
  public static async fetchPoolsData(): Promise<BE.PoolResponse> {
    try {
      const actor = await getActor();
      if (!actor) {
        return {
          pools: [],
          total_tvl: 0n,
          total_24h_volume: 0n,
          total_24h_lp_fee: 0n
        };
      }
      const result = await actor.pools([]);

      if (!result || !result.Ok) {
        console.error('Unexpected response structure:', result);
        throw new Error('Invalid response from actor');
      }

      // Ensure all required properties are present
      const validatedData = PoolResponseSchema.parse(result.Ok);

      // Provide default value for lp_token_symbol if missing
      validatedData.pools = validatedData.pools.map(pool => ({
        ...pool,
        lp_token_symbol: pool.lp_token_symbol || 'default_symbol' // Provide a default value
      }));

      return validatedData as BE.PoolResponse;
    } catch (error) {
      console.error('Error fetching pools:', error);
      throw new Error('Failed to fetch pools data');
    }
  }

  // Pool Operations
  public static async getPoolDetails(poolId: string): Promise<BE.Pool> {
    try {
      const actor = await getActor();
      return await actor.get_by_pool_id(poolId);
    } catch (error) {
      console.error('Error fetching pool details:', error);
      throw new Error(`Failed to fetch details for pool ${poolId}`);
    }
  }

  /**
   * Calculate required amounts for adding liquidity
   */
  public static async calculateLiquidityAmounts(
    token0Symbol: string,
    amount0: bigint,
    token1Symbol: string
  ): Promise<any> {
    try {
      const actor = await getActor();
      const result = await actor.add_liquidity_amounts(
        token0Symbol,
        amount0,
        token1Symbol
      );
      
      if (!result.Ok) {
        throw new Error(result.Err || 'Failed to calculate liquidity amounts');
      }
      
      return result;
    } catch (error) {
      console.error('Error calculating liquidity amounts:', error);
      throw error;
    }
  }

  /**
   * Calculate amounts that would be received when removing liquidity
   */
  public static async calculateRemoveLiquidityAmounts(
    token0Symbol: string,
    token1Symbol: string,
    lpTokenAmount: bigint
  ): Promise<any> {
    try {
      const actor = await getActor();
      const result = await actor.remove_liquidity_amounts(
        token0Symbol,
        token1Symbol,
        lpTokenAmount
      );
      
      if (!result.Ok) {
        throw new Error(result.Err || 'Failed to calculate removal amounts');
      }
      
      return result;
    } catch (error) {
      console.error('Error calculating removal amounts:', error);
      throw error;
    }
  }


  public static async addLiquidityAmounts(
    token0Symbol: string,
    amount0: bigint,
    token1Symbol: string
  ): Promise<any> {
    return this.calculateLiquidityAmounts(token0Symbol, amount0, token1Symbol);
  }

  /**
   * Add liquidity to a pool with ICRC2 approval
   */
  public static async addLiquidity(params: {
    token_0: FE.Token;
    amount_0: bigint;
    token_1: FE.Token;
    amount_1: bigint;
    tx_id_0?: number[];
    tx_id_1?: number[];
  }): Promise<bigint> {
    await walletValidator.requireWalletConnection();
    
    try {
      if (!params.token_0 || !params.token_1) {
        throw new Error('Invalid token configuration');
      }
      
      const [_approval0, _approval1, actor] = await Promise.all([
        IcrcService.checkAndRequestIcrc2Allowances(
          params.token_0,
          params.amount_0,
        ),
        IcrcService.checkAndRequestIcrc2Allowances(
          params.token_1,
          params.amount_1,
        ),
        getActor()
      ]);

      const result = await actor.add_liquidity_async({
        token_0: params.token_0.token,
        amount_0: params.amount_0,
        token_1: params.token_1.token,
        amount_1: params.amount_1,
        tx_id_0: params.tx_id_0 || [],
        tx_id_1: params.tx_id_1 || []
      });

      if ('Err' in result) {
        throw new Error(result.Err || 'Failed to add liquidity');
      }

      return result.Ok;
    } catch (error) {
      console.error('Error adding liquidity:', error);
      throw error;
    }
  }

  /**
   * Poll for request status
   */
  public static async pollRequestStatus(requestId: bigint): Promise<any> {
    try {
      const actor = await getActor();
      const result = await actor.requests([requestId]);
      
      if (!result.Ok || result.Ok.length === 0) {
        throw new Error('Failed to get request status');
      }
      
      return result.Ok[0];
    } catch (error) {
      console.error('Error polling request status:', error);
      throw error;
    }
  }

  public static async removeLiquidity(params: any): Promise<string> {
    await walletValidator.requireWalletConnection();
    try {
      const actor = await getActor();
      const result = await actor.remove_liquidity_async({
        token_0: params.token0,
        token_1: params.token1,
        remove_lp_token_amount: params.lpTokenAmount
      });
      return result.Ok;
    } catch (error) {
      console.error('Error removing liquidity:', error);
      throw new Error('Failed to remove liquidity');
    }
  }

  /**
   * Fetch the user's pool balances.
   */
  public static async fetchUserPoolBalances(): Promise<FE.UserPoolBalance[]> {
    try {
      const isWalletConnected = get(walletStore).isConnected;
      if (!isWalletConnected) {
        return [];
      }
      const actor = await getActor();

      if (!actor) {
        throw new Error('Actor not available');
      }

      const result: Record<string, any[]> = await actor.user_balances([]);

      if (!result || !result.Ok) {
        throw new Error('Failed to fetch user pool balances');
      }

      // Ensure all required properties are present
      const validatedBalances = result.Ok.map(lpToken => UserPoolBalanceSchema.parse(lpToken.LP) as FE.UserPoolBalance);
      return validatedBalances;
    } catch (error) {
      console.error('Error fetching user pool balances:', error);
      throw error;
    }
  }
}

