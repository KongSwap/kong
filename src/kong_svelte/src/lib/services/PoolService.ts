// services/PoolService.ts
import { getActor } from '$lib/stores/walletStore';
import { walletValidator } from '$lib/validators/walletValidator';

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
          total_tvl: 0,
          total_24h_volume: 0,
          total_24h_lp_fee: 0
        };
      }
      const result = await actor.pools([]);

      if (!result || !result.Ok) {
        console.error('Unexpected response structure:', result);
        throw new Error('Invalid response from actor');
      }

      const { pools, total_tvl, total_24h_volume, total_24h_lp_fee } = result.Ok;

      if (!pools) {
        console.error('Pools data is undefined:', result.Ok);
        throw new Error('Invalid pools data received');
      }

      return {
        pools: pools || [],
        total_tvl: total_tvl || 0n,
        total_24h_volume: total_24h_volume || 0n,
        total_24h_lp_fee: total_24h_lp_fee || 0n
      };
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

  /**
   * Add liquidity to a pool
   */
  public static async addLiquidity(params: {
    token_0: string;
    amount_0: bigint;
    token_1: string;
    amount_1: bigint;
    tx_id_0?: number[];
    tx_id_1?: number[];
  }): Promise<string> {
    await walletValidator.requireWalletConnection();
    try {
      const actor = await getActor();
      const result = await actor.add_liquidity_async({
        token_0: params.token_0,
        amount_0: params.amount_0,
        token_1: params.token_1,
        amount_1: params.amount_1,
        tx_id_0: params.tx_id_0 || [],
        tx_id_1: params.tx_id_1 || []
      });
      
      if (!result.Ok) {
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
  public static async pollRequestStatus(requestId: string): Promise<any> {
    try {
      const actor = await getActor();
      const result = await actor.requests([BigInt(requestId)]);
      
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
}
