declare global {
  namespace BE {
    interface PoolResponse {
      pools: Pool[];
      total_tvl: bigint;
      total_24h_volume: bigint;
      total_24h_lp_fee: bigint;
      total_24h_num_swaps: number;
    }

    export interface Position {
      id: string;
      amount0: string;
      amount1: string;
      value: number;
  } 
  
    interface Pool {
      id: string;
      lp_token_symbol: string;
      name: string;
      lp_fee_0: bigint;
      lp_fee_1: bigint;
      balance_0: bigint;
      balance_1: bigint;
      rolling_24h_volume: bigint;
      rolling_24h_apy: number;
      rolling_24h_num_swaps: number;
      rolling_24h_lp_fee: bigint;
      address_0: string;
      address_1: string;
      symbol_0: string;
      symbol_1: string;
      tvl: bigint;
      pool_id: number;
      price: number;
      chain_0: string;
      chain_1: string;
      lp_token_supply: bigint;
      symbol: string;
      lp_fee_bps: number;
      tvl?: bigint;
      volume_24h?: string;
      apr?: number;
      is_removed: boolean;
      timestamp?: number;
    }
  }
}

export {};
