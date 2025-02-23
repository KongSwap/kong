import type { Principal } from '@dfinity/principal';

export interface MinerTier {
  type: 'basic' | 'standard' | 'premium';
  kong: number;
  cycles: string;
  color: string;
}

export interface TokenInit {
  name: string;
  ticker: string;
  total_supply: bigint;
}

export interface MinerInit {
  amount: bigint;
  slippage: number;
}

export type MinersList = [Principal, string][];

export interface BackendActor {
  get_created_miners: () => Promise<MinersList>;
  create_miner_with_kong: (init: MinerInit) => Promise<Result>;
}

export interface TokenActor {
  init: (init: TokenInit) => Promise<Result>;
}

export interface Result {
  Ok?: Principal;
  Err?: string;
}
