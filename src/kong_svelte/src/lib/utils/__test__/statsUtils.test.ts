import { describe, it, expect, vi } from 'vitest';
import { 
  getPriceChangeClass, 
  formatPoolData, 
  getPoolPriceUsd,
} from '$lib/utils/statsUtils';
import BigNumber from 'bignumber.js';

// Mock the stores
vi.mock('$lib/stores/userTokens', () => ({
  userTokens: {
    subscribe: vi.fn((callback) => {
      callback({ tokens: [
        { address: 'token1', metrics: { price: '100' } },
        { address: 'token2', metrics: { price: '50' } }
      ]});
      return { unsubscribe: vi.fn() };
    })
  }
}));

function createMockPool(overrides: Partial<BE.Pool> = {}): BE.Pool {
  return {
    id: '',
    lp_token_symbol: '',
    name: '',
    rolling_24h_volume: 0n,
    rolling_24h_apy: '0',
    address_0: '',
    address_1: '',
    symbol_0: '',
    symbol_1: '',
    price: 0,
    balance_0: 0n,
    balance_1: 0n,
    lp_fee_0: 0n,
    lp_fee_1: 0n,
    rolling_24h_lp_fee: 0n,
    rolling_24h_num_swaps: 0n,
    pool_id: 0,
    chain_0: '',
    chain_1: '',
    lp_token_supply: 0n,
    symbol: '',
    lp_fee_bps: 0,
    tvl: 0n,
    is_removed: false,
    lp_token_id: '',
    ...overrides
  };
}

describe('getPriceChangeClass', () => {
  it('should return empty string for undefined price change', () => {
    const token = { metrics: {} } as Kong.Token;
    expect(getPriceChangeClass(token)).toBe('');
  });

  it('should return green class for positive price change', () => {
    const token = { metrics: { price_change_24h: '5.5' } } as Kong.Token;
    expect(getPriceChangeClass(token)).toBe('text-kong-success');
  });

  it('should return red class for negative price change', () => {
    const token = { metrics: { price_change_24h: '-3.2' } } as Kong.Token;
    expect(getPriceChangeClass(token)).toBe('text-kong-error');
  });

  it('should return empty string for zero price change', () => {
    const token = { metrics: { price_change_24h: '0' } } as Kong.Token;
    expect(getPriceChangeClass(token)).toBe('');
  });
});

describe('formatPoolData', () => {
  it('should return empty array for empty input', async () => {
    const result = await formatPoolData([]);
    expect(result).toEqual([]);
  });

  it('should format pool data correctly', async () => {
    const pools: BE.Pool[] = [createMockPool({
      address_1: 'token1',
      symbol_0: 'BTC',
      symbol_1: 'USDT',
      price: 2,
      rolling_24h_apy: '10.50'
    })];

    const result = await formatPoolData(pools);
    
    expect(result[0]).toMatchObject({
      price_usd: '200',
      id: 'BTC-USDT-0',
      apy: '10.50'
    });
  });
});

describe('getPoolPriceUsd', () => {
  it('should return 0 for null pool', () => {
    expect(getPoolPriceUsd(null as unknown as BE.Pool)).toBe(0);
  });

  it('should calculate pool price correctly', () => {
    const pool = createMockPool({
      balance_0: BigInt('1000000'),
      balance_1: BigInt('2000000'),
      lp_fee_0: BigInt('1000'),
      lp_fee_1: BigInt('2000')
    });

    const expectedPrice = new BigNumber('2002000').div(new BigNumber('1001000'));
    expect(getPoolPriceUsd(pool)).toBe(expectedPrice.toNumber());
  });

  it('should handle zero balances', () => {
    const pool = createMockPool({
      balance_0: 0n,
      balance_1: 0n,
      lp_fee_0: 0n,
      lp_fee_1: 0n
    });

    const result = getPoolPriceUsd(pool);
    expect(isNaN(result) || result === 0).toBe(true);
  });

  it('should handle large numbers', () => {
    const pool = createMockPool({
      balance_0: BigInt('1000000000000'),
      balance_1: BigInt('2000000000000'),
      lp_fee_0: BigInt('1000000'),
      lp_fee_1: BigInt('2000000')
    });

    const expectedPrice = new BigNumber('2000002000000').div(new BigNumber('1000001000000'));
    expect(getPoolPriceUsd(pool)).toBe(expectedPrice.toNumber());
  });
}); 