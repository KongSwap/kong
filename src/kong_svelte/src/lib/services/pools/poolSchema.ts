import { z } from 'zod';

// Define a schema for a pool
export const PoolSchema = z.object({
  lp_token_symbol: z.string().optional(),
  name: z.string(),
  lp_fee_0: z.bigint(),
  lp_fee_1: z.bigint(),
  balance_0: z.bigint(),
  balance_1: z.bigint(),
  rolling_24h_volume: z.bigint(),
  rolling_24h_apy: z.number(),
  address_0: z.string(),
  address_1: z.string(),
  symbol_0: z.string(),
  symbol_1: z.string(),
  tvl: z.bigint(),
  pool_id: z.number(),
  price: z.number(),
  chain_0: z.string(),
  chain_1: z.string(),
  lp_token_supply: z.bigint(),
  symbol: z.string(),
  lp_fee_bps: z.number(),
  is_removed: z.boolean().optional(),
  logo: z.string().optional(),
  total_24h_volume: z.bigint().optional(),
});

// Define a schema for user pool balance
export const UserPoolBalanceSchema = z.object({
  amount_0: z.bigint(),
  amount_1: z.bigint(),
  balance: z.bigint(),
  name: z.string(),
  symbol: z.string(),
  symbol_0: z.string(),
  symbol_1: z.string(),
  ts: z.bigint(),
  usd_amount_0: z.number(),
  usd_amount_1: z.number(),
  usd_balance: z.number(),
});

// Define a schema for the pool response
export const PoolResponseSchema = z.object({
  pools: z.array(PoolSchema),
  total_tvl: z.bigint(),
  total_24h_volume: z.bigint(),
  total_24h_lp_fee: z.bigint(),
});