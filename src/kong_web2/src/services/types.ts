import { Actor } from "@dfinity/agent";

export type TransactionType = "AddPool" | "AddLiquidity" | "RemoveLiquidity" | "Swap";

export interface ICanisterActor {
  actor: Actor;
}

export interface TokenData {
  token_id: number;
  pool_symbol: string;
  name: string;
  chain: string;
  symbol: string;
  token: string;
  on_kong: boolean;
  pool_id_of?: number;
  address?: string;
  decimals?: number;
  fee?: bigint;
  total_supply?: bigint;
  canister_id?: string;
  icrc1?: boolean;
  icrc2?: boolean;
  icrc3?: boolean;
}

export interface PoolData {
  pool_id: number;
  name: string;
  symbol: string;
  balance: bigint;
  chain_0: string;
  symbol_0: string;
  address_0: string;
  balance_0: bigint;
  lp_fee_0: bigint;
  chain_1: string;
  symbol_1: string;
  address_1: string;
  balance_1: bigint;
  lp_fee_1: bigint;
  price: number;
  lp_fee_bps: number;
  rolling_24h_volume: bigint;
  rolling_24h_lp_fee: bigint;
  rolling_24h_num_swaps: number;
  rolling_24h_apy: number;
  lp_token_symbol: string;
  lp_token_supply: bigint;
  total_volume: bigint;
  total_lp_fee: bigint;
  on_kong: boolean;
}
