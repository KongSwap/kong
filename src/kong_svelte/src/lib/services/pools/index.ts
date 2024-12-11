import { PoolService } from './PoolService';
import { poolStore } from './poolStore';

export interface Pool {
  pool_id: string;
  address_0: string;
  address_1: string;
  symbol_0: string;
  symbol_1: string;
  tvl: string;
  daily_volume?: string;
  apy?: string;
  lp_token_supply?: string;
}

export { PoolService, poolStore };
