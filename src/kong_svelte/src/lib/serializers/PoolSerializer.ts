// Custom serializer for Pool data without using Zod
import { BaseSerializer } from './BaseSerializer';

/**
 * Safely converts a value to BigInt
 * @param value - The value to convert
 * @returns BigInt value or 0n if conversion fails
 */
function toBigInt(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(Math.floor(value));
    if (typeof value === 'string') return BigInt(value);
    return 0n;
  } catch (error) {
    console.error('Error converting to BigInt:', error);
    return 0n;
  }
}

/**
 * Safely converts a value to number
 * @param value - The value to convert
 * @returns number value or 0 if conversion fails
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  
  try {
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') return Number(value);
    return 0;
  } catch (error) {
    console.error('Error converting to number:', error);
    return 0;
  }
}

/**
 * Safely converts a value to string
 * @param value - The value to convert
 * @returns string value or empty string if conversion fails
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) return '';
  
  try {
    return String(value);
  } catch (error) {
    console.error('Error converting to string:', error);
    return '';
  }
}

/**
 * Safely converts a value to boolean
 * @param value - The value to convert
 * @returns boolean value or false if conversion fails
 */
function toBoolean(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return Boolean(value);
}

export class PoolSerializer extends BaseSerializer {
  static serializePoolsResponse(response: unknown): BE.PoolResponse {
    try {
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format');
      }
      
      const data = response as Record<string, unknown>;
      
      if (!Array.isArray(data.pools)) {
        throw new Error('Pools must be an array');
      }
      
      return {
        pools: data.pools.map(pool => this.serializePool(pool)),
        total_tvl: this.toBigInt(data.total_tvl),
        total_24h_volume: this.toBigInt(data.total_24h_volume),
        total_24h_lp_fee: this.toBigInt(data.total_24h_lp_fee),
        total_24h_num_swaps: this.toNumber(data.total_24h_num_swaps)
      };
    } catch (error) {
      console.error('Error serializing pools response:', error);
      throw error;
    }
  }

  static serializePool(rawPool: unknown): BE.Pool {
    if (!rawPool || typeof rawPool !== 'object') {
      throw new Error('Invalid pool data');
    }
    
    const pool = rawPool as Record<string, unknown>;
    
    const balance_0 = this.toBigInt(pool.balance_0);
    const balance_1 = this.toBigInt(pool.balance_1);
    const pool_id = this.toNumber(pool.pool_id);
    
    return {
      id: this.toString(pool.pool_id),
      pool_id,
      name: this.toString(pool.name),
      symbol: this.toString(pool.symbol),
      chain_0: this.toString(pool.chain_0),
      symbol_0: this.toString(pool.symbol_0),
      address_0: this.toString(pool.address_0),
      balance_0,
      lp_fee_0: this.toBigInt(pool.lp_fee_0),
      chain_1: this.toString(pool.chain_1),
      symbol_1: this.toString(pool.symbol_1),
      address_1: this.toString(pool.address_1),
      balance_1,
      lp_fee_1: this.toBigInt(pool.lp_fee_1),
      price: this.toNumber(pool.price),
      lp_fee_bps: this.toNumber(pool.lp_fee_bps),
      rolling_24h_volume: this.toBigInt(pool.rolling_24h_volume),
      rolling_24h_lp_fee: this.toBigInt(pool.rolling_24h_lp_fee),
      rolling_24h_num_swaps: this.toBigInt(pool.rolling_24h_num_swaps),
      rolling_24h_apy: this.toNumber(pool.rolling_24h_apy).toFixed(2),
      lp_token_symbol: this.toString(pool.lp_token_symbol),
      tvl: this.toBigInt(pool.tvl),
      is_removed: this.toBoolean(pool.is_removed),
      lp_token_supply: balance_0 + balance_1
    };
  }
} 