/// <reference path="../../types/index.d.ts" />

import { describe, it, expect, vi } from 'vitest';
import {
  formatDisplayValue,
  isValidNumber,
  calculateMaxAmount,
  formatWithCommas,
  hasInsufficientBalance,
  getButtonText,
  calculatePoolRatio,
  calculateUsdRatio,
  formatLargeNumber,
  processLiquidityInput,
  calculateUsdValue,
  findPool,
  validateLiquidityForm
} from '$lib/utils/liquidityUtils';

// Updated mock tokenStore with bigger balances in microtokens
vi.mock('$lib/stores/tokenStore', () => {
  const storeValue = {
    balances: {
      'token0-id': { in_tokens: '200000000000' },
      'token1-id': { in_tokens: '200000000000' }
    }
  };

  const balancesStoreValue = {
    'token0-id': { in_tokens: '200000000000' },
    'token1-id': { in_tokens: '200000000000' }
  };

  return {
    tokenStore: {
      subscribe: vi.fn((callback) => {
        callback(storeValue);
        return { unsubscribe: vi.fn() };
      })
    },
    currentUserBalancesStore: {
      subscribe: vi.fn((callback) => {
        callback(balancesStoreValue);
        return { unsubscribe: vi.fn() };
      })
    }
  };
});

describe('formatDisplayValue', () => {
  it('should format display values correctly', () => {
    expect(formatDisplayValue('0', 6)).toBe('0');
    expect(formatDisplayValue('123.456789', 4)).toBe('0.0123');
    expect(formatDisplayValue('123.', 2)).toBe('1.23');
    expect(formatDisplayValue('123.00', 2)).toBe('1.23');
  });
});

describe('isValidNumber', () => {
  it('should validate number inputs correctly', () => {
    expect(isValidNumber('')).toBe(true);
    expect(isValidNumber('123')).toBe(true);
    expect(isValidNumber('123.456')).toBe(true);
    expect(isValidNumber('1,234.56')).toBe(true);
    expect(isValidNumber('1e-6')).toBe(true);
    expect(isValidNumber('abc')).toBe(false);
    expect(isValidNumber('12.34.56')).toBe(false);
  });
});

describe('formatWithCommas', () => {
  it('should format numbers with commas correctly', () => {
    expect(formatWithCommas('')).toBe('0');
    expect(formatWithCommas('1234')).toBe('1,234');
    expect(formatWithCommas('1234.5678')).toBe('1,234.5678');
    expect(formatWithCommas('1000000')).toBe('1,000,000');
  });
});

describe('calculatePoolRatio', () => {
  it('should calculate pool ratios correctly', () => {
    const token0 = { symbol: 'BTC' } as FE.Token;
    const token1 = { symbol: 'USDT' } as FE.Token;
    
    expect(calculatePoolRatio(token0, token1, '1', '50000')).toBe('1 BTC = 50000.000000 USDT');
    expect(calculatePoolRatio(token0, token1, '0', '50000')).toBe('');
    expect(calculatePoolRatio(null, token1, '1', '50000')).toBe('');
  });
});

describe('calculateUsdRatio', () => {
  it('should calculate USD ratios correctly', () => {
    const token0 = { symbol: 'BTC', metrics: { price: '50000' } } as FE.Token;
    const token1 = { symbol: 'USDT', metrics: { price: '1' } } as FE.Token;
    
    expect(calculateUsdRatio(token0, token1)).toBe('1 BTC ≈ $50000.00');
    expect(calculateUsdRatio(null, token1)).toBe('');
  });
});

describe('formatLargeNumber', () => {
  it('should format numbers with different decimal places', () => {
    expect(formatLargeNumber('1234567890', 3)).toBe('1,234.568');
    expect(formatLargeNumber('500000', 1)).toBe('0.5');
    expect(formatLargeNumber('1500000', 0)).toBe('2');
    expect(formatLargeNumber('999999', 2)).toBe('1.00');
  });

  it('should handle edge cases', () => {
    expect(formatLargeNumber('0', 2)).toBe('0.00');
    expect(formatLargeNumber('1000000', 2)).toBe('1.00');
    expect(formatLargeNumber('999999999999', 2)).toBe('1,000,000.00');
    expect(formatLargeNumber('1234567', 6)).toBe('1.234567');
  });

  it('should handle very large numbers', () => {
    expect(formatLargeNumber('1000000000000', 2)).toBe('1,000,000.00'); // 1M
    expect(formatLargeNumber('1000000000000000', 2)).toBe('1,000,000,000.00'); // 1B
    expect(formatLargeNumber('1000000000000000000', 2)).toBe('1,000,000,000,000.00'); // 1T
  });
});

describe('processLiquidityInput', () => {
  it('should process liquidity inputs correctly', () => {
    expect(processLiquidityInput('', 6)).toBe('0');
    expect(processLiquidityInput('123.456789', 4)).toBe('123.4567');
    expect(processLiquidityInput('00123', 2)).toBe('123');
    expect(processLiquidityInput('abc', 2, '0')).toBe('0');
  });
});

describe('calculateUsdValue', () => {
  it('should calculate USD values correctly', () => {
    expect(calculateUsdValue('1', '50000')).toBe(50000);
    expect(calculateUsdValue('1.5', '1000')).toBe(1500);
    expect(calculateUsdValue('0', '1000')).toBe(0);
  });
});

describe('findPool', () => {
  it('should find matching pools', () => {
    const token0 = { canister_id: 'token0-id' } as FE.Token;
    const token1 = { canister_id: 'token1-id' } as FE.Token;
    const pools = [
      { address_0: 'token0-id', address_1: 'token1-id' } as BE.Pool,
      { address_0: 'token2-id', address_1: 'token3-id' } as BE.Pool
    ];

    expect(findPool(token0, token1, pools)).toBe(pools[0]);
    expect(findPool(null, token1, pools)).toBe(null);
    expect(findPool(token0, token1, [])).toBe(null);
  });
});

describe('validateLiquidityForm', () => {
  it('should validate liquidity form correctly', () => {
    const token0 = { canister_id: 'token0-id' } as FE.Token;
    const token1 = { canister_id: 'token1-id' } as FE.Token;
    const pool = { address_0: 'token0-id', address_1: 'token1-id' } as BE.Pool;

    expect(validateLiquidityForm(
      token0,
      token1,
      '100',
      '5000',
      null,
      false,
      pool
    )).toBe(true);

    expect(validateLiquidityForm(
      null,
      token1,
      '100',
      '5000',
      null,
      false,
      pool
    )).toBe(false);

    expect(validateLiquidityForm(
      token0,
      token1,
      '0',
      '5000',
      null,
      false,
      pool
    )).toBe(false);
  });
});

describe('calculateMaxAmount', () => {
  it('should calculate max amount considering transfer fees', async () => {
    const token = {
      fee_fixed: '1000',
      decimals: 6,
    } as FE.Token;
    
    expect(await calculateMaxAmount(token, '100000000', 1)).toBe('99.999000');
    expect(await calculateMaxAmount(token, '2000', 2)).toBe('0');
  });

  it('should handle invalid inputs', async () => {
    const token = {
      fee_fixed: '1000',
      decimals: 6,
    } as FE.Token;

    await expect(calculateMaxAmount(token, '500', 1)).rejects.toThrow('Insufficient balance to cover fees');
    
    const tokenWithoutFee = {
      ...token,
      fee_fixed: undefined
    } as unknown as FE.Token;
    
    await expect(calculateMaxAmount(tokenWithoutFee, '1000', 1))
      .rejects.toThrow('Could not determine token fee');
  });
});

describe('hasInsufficientBalance', () => {
  it('should correctly check for insufficient balances', () => {
    const token0 = {
      canister_id: 'token0-id',
      address: 'token0-id',
      decimals: 6,
      fee_fixed: '1000'
    } as FE.Token;

    const token1 = {
      canister_id: 'token1-id',
      address: 'token1-id',
      decimals: 6,
      fee_fixed: '1000'
    } as FE.Token;

    // Test with amounts less than balances => should be sufficient:
    expect(hasInsufficientBalance('100000', '100000', token0, token1)).toBe(false);

    // Test with amounts greater than balances => should be insufficient:
    expect(hasInsufficientBalance('100000000', '240000000', token0, token1)).toBe(true);
    expect(hasInsufficientBalance('120000000', '10000000', token0, token1)).toBe(true);
  });

  it('should handle missing tokens', () => {
    expect(hasInsufficientBalance('100', '100', null as unknown as FE.Token, null as unknown as FE.Token)).toBe(false);
  });
});

describe('getButtonText', () => {
  const token0 = { symbol: 'BTC' } as FE.Token;
  const token1 = { symbol: 'USDT' } as FE.Token;

  it('should return appropriate button text based on form state', () => {
    // Test various states
    expect(getButtonText(null, token1, true, false, '100', '5000', false, '')).toBe('Select Tokens');
    expect(getButtonText(token0, token1, true, true, '100', '5000', false, '')).toBe('Insufficient Balance');
    expect(getButtonText(token0, token1, true, false, '', '5000', false, '')).toBe('Enter Amounts');
    expect(getButtonText(token0, token1, true, false, '100', '5000', true, 'Processing...')).toBe('Processing...');
    expect(getButtonText(token0, token1, true, false, '100', '5000', false, '')).toBe('Review Transaction');
  });
});

describe('processLiquidityInput', () => {
  it('should handle edge cases', () => {
    expect(processLiquidityInput('00.123', 6)).toBe('0.123');
    expect(processLiquidityInput('.123', 6)).toBe('0.123');
    expect(processLiquidityInput('123.', 6)).toBe('123');
    expect(processLiquidityInput('1.23456789', 4)).toBe('1.2345');
    expect(processLiquidityInput('invalid', 6, '1')).toBe('1');
  });

  it('should handle number formatting', () => {
    expect(processLiquidityInput('1,234.56', 2)).toBe('1234.56');
    expect(processLiquidityInput('1_000_000', 2)).toBe('1000000');
    expect(processLiquidityInput('0000123', 2)).toBe('123');
  });
});

describe('calculateUsdValue', () => {
  it('should handle various number formats', () => {
    expect(calculateUsdValue('1,000', '1.5')).toBe(1500);
    expect(calculateUsdValue('1_000_000', '2')).toBe(2000000);
    expect(calculateUsdValue('0.5', '2000')).toBe(1000);
    expect(calculateUsdValue('0', '1000')).toBe(0);
  });
});

describe('formatLargeNumber', () => {
  it('should format numbers with different decimal places', () => {
    expect(formatLargeNumber('1234567890', 3)).toBe('1,234.568');
    expect(formatLargeNumber('500000', 1)).toBe('0.5');
    expect(formatLargeNumber('1500000', 0)).toBe('2');
    expect(formatLargeNumber('999999', 2)).toBe('1.00');
  });

  it('should handle edge cases', () => {
    expect(formatLargeNumber('0', 2)).toBe('0.00');
    expect(formatLargeNumber('1000000', 2)).toBe('1.00');
    expect(formatLargeNumber('999999999999', 2)).toBe('1,000,000.00');
    expect(formatLargeNumber('1234567', 6)).toBe('1.234567');
  });

  it('should handle very large numbers', () => {
    expect(formatLargeNumber('1000000000000', 2)).toBe('1,000,000.00'); // 1M
    expect(formatLargeNumber('1000000000000000', 2)).toBe('1,000,000,000.00'); // 1B
    expect(formatLargeNumber('1000000000000000000', 2)).toBe('1,000,000,000,000.00'); // 1T
  });
}); 