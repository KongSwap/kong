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
      const result = await actor.pools([]);
      return result.Ok || {
        pools: [],
        total_tvl: 0n,
        total_24h_volume: 0n,
        total_24h_lp_fee: 0n
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

  // Liquidity Operations
  public static async addLiquidity(params: any): Promise<string> {
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
      return result.Ok;
    } catch (error) {
      console.error('Error adding liquidity:', error);
      throw new Error('Failed to add liquidity');
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
