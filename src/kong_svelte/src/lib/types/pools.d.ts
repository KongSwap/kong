export interface Pool {
  id: string;
  token0_symbol: string;
  token1_symbol: string;
  fee: number;
  tvl_usd: number;
  rolling_24h_apy: number;
  address_0: string;
  address_1: string;
  price: number;
  rolling_24h_volume: number;
  lp_token_symbol: string;
}

export interface UserPool extends Pool {
  balance: bigint;
  token0_balance: bigint;
  token1_balance: bigint;
} 