import { z } from 'zod';

// Define the schema for validation and parsing
const poolSchema = z.object({
  pool_id: z.number(),
  name: z.string(),
  symbol: z.string(),
  chain_0: z.string(),
  symbol_0: z.string(),
  address_0: z.string(),
  balance_0: z.string().or(z.bigint()).transform(val => BigInt(val)),
  lp_fee_0: z.string().or(z.bigint()).transform(val => BigInt(val)),
  chain_1: z.string(),
  symbol_1: z.string(),
  address_1: z.string(),
  balance_1: z.string().or(z.bigint()).transform(val => BigInt(val)),
  lp_fee_1: z.string().or(z.bigint()).transform(val => BigInt(val)),
  price: z.number(),
  lp_fee_bps: z.number(),
  rolling_24h_volume: z.string().or(z.bigint()).transform(val => BigInt(val)),
  rolling_24h_lp_fee: z.string().or(z.bigint()).transform(val => BigInt(val)),
  rolling_24h_num_swaps: z.string().or(z.bigint()).transform(val => Number(val)),
  rolling_24h_apy: z.number(),
  lp_token_symbol: z.string(),
  tvl: z.string().or(z.bigint()).transform(val => BigInt(val)),
  on_kong: z.boolean()
});

const poolResponseSchema = z.object({
  pools: z.array(poolSchema),
  total_tvl: z.string().or(z.bigint()).transform(val => BigInt(val)),
  total_24h_volume: z.string().or(z.bigint()).transform(val => BigInt(val)),
  total_24h_lp_fee: z.string().or(z.bigint()).transform(val => BigInt(val)),
  total_24h_num_swaps: z.string().or(z.bigint()).transform(val => Number(val))
});

export class PoolSerializer {
  static serializePoolsResponse(response: unknown): BE.PoolResponse {
    try {
      const parsed = poolResponseSchema.parse(response);
      return {
        pools: parsed.pools.map(pool => ({
          id: pool.pool_id.toString(),
          pool_id: pool.pool_id,
          name: pool.name,
          symbol: pool.symbol,
          chain_0: pool.chain_0,
          symbol_0: pool.symbol_0,
          address_0: pool.address_0,
          balance_0: pool.balance_0,
          lp_fee_0: pool.lp_fee_0,
          chain_1: pool.chain_1,
          symbol_1: pool.symbol_1,
          address_1: pool.address_1,
          balance_1: pool.balance_1,
          lp_fee_1: pool.lp_fee_1,
          price: pool.price,
          lp_fee_bps: pool.lp_fee_bps,
          rolling_24h_volume: pool.rolling_24h_volume,
          rolling_24h_lp_fee: pool.rolling_24h_lp_fee,
          rolling_24h_num_swaps: pool.rolling_24h_num_swaps,
          rolling_24h_apy: pool.rolling_24h_apy,
          lp_token_symbol: pool.lp_token_symbol,
          tvl: pool.tvl,
          on_kong: pool.on_kong,
          lp_token_supply: BigInt(0)
        })),
        total_tvl: parsed.total_tvl,
        total_24h_volume: parsed.total_24h_volume,
        total_24h_lp_fee: parsed.total_24h_lp_fee,
        total_24h_num_swaps: parsed.total_24h_num_swaps
      };
    } catch (error) {
      console.error('Error serializing pools response:', error);
      throw error;
    }
  }

  static serializePool(rawPool: unknown): BE.Pool {
    const parsed = poolSchema.parse(rawPool);    
    return {
      id: parsed.pool_id.toString(),
      pool_id: parsed.pool_id,
      name: parsed.name,
      symbol: parsed.symbol,
      chain_0: parsed.chain_0,
      symbol_0: parsed.symbol_0,
      address_0: parsed.address_0,
      balance_0: parsed.balance_0,
      lp_fee_0: parsed.lp_fee_0,
      chain_1: parsed.chain_1,
      symbol_1: parsed.symbol_1,
      address_1: parsed.address_1,
      balance_1: parsed.balance_1,
      lp_fee_1: parsed.lp_fee_1,
      price: parsed.price,
      lp_fee_bps: parsed.lp_fee_bps,
      rolling_24h_volume: parsed.rolling_24h_volume,
      rolling_24h_lp_fee: parsed.rolling_24h_lp_fee,
      rolling_24h_num_swaps: parsed.rolling_24h_num_swaps,
      rolling_24h_apy: parsed.rolling_24h_apy,
      lp_token_symbol: parsed.lp_token_symbol,
      tvl: BigInt(parsed.tvl),
      on_kong: parsed.on_kong,
      lp_token_supply: BigInt(0)
    };
  }
} 