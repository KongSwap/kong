import { describe, it, expect, vi } from 'vitest';
import { 
  getPriceChangeClass, 
  formatPoolData, 
  filterPools, 
  filterTokens,
  getPoolPriceUsd,
  type EnhancedToken
} from '$lib/utils/statsUtils';
import BigNumber from 'bignumber.js';

// Mock the stores
vi.mock('$lib/stores/userTokens', () => ({
  userTokens: {
    subscribe: vi.fn((callback) => {
      callback({ tokens: [
        { canister_id: 'token1', metrics: { price: '100' } },
        { canister_id: 'token2', metrics: { price: '50' } }
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
    rolling_24h_apy: 0,
    address_0: '',
    address_1: '',
    decimals_0: 0,
    decimals_1: 0,
    total_shares: '',
    shares_to_tokens_rate: '',
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
    ...overrides
  };
}

describe('getPriceChangeClass', () => {
  it('should return empty string for undefined price change', () => {
    const token = { metrics: {} } as FE.Token;
    expect(getPriceChangeClass(token)).toBe('');
  });

  it('should return green class for positive price change', () => {
    const token = { metrics: { price_change_24h: '5.5' } } as FE.Token;
    expect(getPriceChangeClass(token)).toBe('text-kong-accent-green');
  });

  it('should return red class for negative price change', () => {
    const token = { metrics: { price_change_24h: '-3.2' } } as FE.Token;
    expect(getPriceChangeClass(token)).toBe('text-kong-accent-red');
  });

  it('should return empty string for zero price change', () => {
    const token = { metrics: { price_change_24h: '0' } } as FE.Token;
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
      rolling_24h_apy: 10.50
    })];

    const result = await formatPoolData(pools);
    
    expect(result[0]).toMatchObject({
      price_usd: '200',
      id: 'BTC-USDT-0',
      apy: '10.50'
    });
  });
});

describe('filterPools', () => {
  const pools: BE.Pool[] = [
    { symbol_0: 'BTC', symbol_1: 'USDT' } as BE.Pool,
    { symbol_0: 'ETH', symbol_1: 'USDC' } as BE.Pool,
    { symbol_0: 'BTC', symbol_1: 'ETH' } as BE.Pool
  ];

  it('should return all pools when query is empty', () => {
    expect(filterPools(pools, '')).toEqual(pools);
  });

  it('should filter pools by symbol pair', () => {
    expect(filterPools(pools, 'BTC')).toHaveLength(2);
    expect(filterPools(pools, 'ETH')).toHaveLength(2);
    expect(filterPools(pools, 'USDT')).toHaveLength(1);
  });

  it('should be case insensitive', () => {
    expect(filterPools(pools, 'btc')).toHaveLength(2);
    expect(filterPools(pools, 'eth')).toHaveLength(2);
  });

  it('should return empty array when no matches found', () => {
    expect(filterPools(pools, 'XRP')).toHaveLength(0);
  });
});

describe('filterTokens', () => {
  const tokens: FE.Token[] = [
    { symbol: 'BTC', name: 'Bitcoin' } as FE.Token,
    { symbol: 'ETH', name: 'Ethereum' } as FE.Token,
    { symbol: 'USDT', name: 'Tether' } as FE.Token
  ];

  it('should return all tokens when query is empty', () => {
    expect(filterTokens(tokens, '')).toEqual(tokens);
  });

  it('should filter tokens by symbol', () => {
    const btcResults = filterTokens(tokens, 'BTC');
    // BTC only matches symbol
    expect(btcResults).toHaveLength(1);
    expect(btcResults[0].symbol).toBe('BTC');
  });

  it('should filter tokens by name', () => {
    const bitcoinResults = filterTokens(tokens, 'Bitcoin');
    // Bitcoin only matches name
    expect(bitcoinResults).toHaveLength(1);
    expect(bitcoinResults[0].name).toBe('Bitcoin');
  });

  it('should be case insensitive', () => {
    const btcResults = filterTokens(tokens, 'btc');
    expect(btcResults).toHaveLength(1);
    expect(btcResults[0].symbol).toBe('BTC');
  });

  it('should return empty array when no matches found', () => {
    expect(filterTokens(tokens, 'XRP')).toHaveLength(0);
  });

  it('should match both symbol and name containing the search term', () => {
    // 'eth' matches both ETH symbol and Ethereum name
    const ethResults = filterTokens(tokens, 'eth');
    expect(ethResults).toHaveLength(2);
    expect(ethResults.some(t => t.symbol === 'ETH')).toBe(true);
    expect(ethResults.some(t => t.name === 'Ethereum')).toBe(true);
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