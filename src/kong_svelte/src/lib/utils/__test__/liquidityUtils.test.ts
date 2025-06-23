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
  findPool,
  getPoolForTokenPair,
  validateTokenSelect,
  calculateToken1FromPrice,
  calculateToken0FromPrice,
  calculateAmountFromPercentage,
  formatToNonZeroDecimal
} from '$lib/utils/liquidityUtils';
import { calculateTokenUsdValue } from '../numberFormatUtils';

// Mock balancesStore with bigger balances in microtokens
vi.mock('$lib/stores/balancesStore', () => {
  const balancesStoreValue = {
    'token0-id': { in_tokens: '200000000000' },
    'token1-id': { in_tokens: '200000000000' }
  };

  return {
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
    const token0 = { symbol: 'BTC' } as Kong.Token;
    const token1 = { symbol: 'USDT' } as Kong.Token;
    
    expect(calculatePoolRatio(token0, token1, '1', '50000')).toBe('1 BTC = 50000.000000 USDT');
    expect(calculatePoolRatio(token0, token1, '0', '50000')).toBe('');
    expect(calculatePoolRatio(null, token1, '1', '50000')).toBe('');
  });
});

describe('calculateUsdRatio', () => {
  it('should calculate USD ratios correctly', () => {
    const token0 = { symbol: 'BTC', metrics: { price: '50000' } } as Kong.Token;
    const token1 = { symbol: 'USDT', metrics: { price: '1' } } as Kong.Token;
    
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

describe('findPool', () => {
  it('should find matching pools', () => {
    const token0 = { address: 'token0-id' } as Kong.Token;
    const token1 = { address: 'token1-id' } as Kong.Token;
    const pools = [
      { address_0: 'token0-id', address_1: 'token1-id' } as BE.Pool,
      { address_0: 'token2-id', address_1: 'token3-id' } as BE.Pool
    ];

    expect(findPool(token0, token1, pools)).toBe(pools[0]);
    expect(findPool(null, token1, pools)).toBe(null);
    expect(findPool(token0, token1, [])).toBe(null);
  });
});

describe('calculateMaxAmount', () => {
  it('should calculate max amount considering transfer fees', async () => {
    const token = {
      fee_fixed: '1000',
      decimals: 6,
    } as Kong.Token;
    
    expect(await calculateMaxAmount(token, '100000000', 1)).toBe('99.999000');
    expect(await calculateMaxAmount(token, '2000', 2)).toBe('0');
  });

  it('should handle invalid inputs', async () => {
    const token = {
      fee_fixed: '1000',
      decimals: 6,
    } as Kong.Token;

    await expect(calculateMaxAmount(token, '500', 1)).rejects.toThrow('Insufficient balance to cover fees');
    
    const tokenWithoutFee = {
      ...token,
      fee_fixed: undefined
    } as unknown as Kong.Token;
    
    await expect(calculateMaxAmount(tokenWithoutFee, '1000', 1))
      .rejects.toThrow('Could not determine token fee');
  });
});

describe('hasInsufficientBalance', () => {
  it('should correctly check for insufficient balances', () => {
    const token0 = {
      address: 'token0-id',
      decimals: 6,
      fee_fixed: '1000'
    } as Kong.Token;

    const token1 = {
      address: 'token1-id',
      decimals: 6,
      fee_fixed: '1000'
    } as Kong.Token;

    // Test with amounts less than balances => should be sufficient:
    expect(hasInsufficientBalance('100000', '100000', token0, token1)).toBe(false);

    // Test with amounts greater than balances => should be insufficient:
    expect(hasInsufficientBalance('100000000', '240000000', token0, token1)).toBe(true);
    expect(hasInsufficientBalance('120000000', '10000000', token0, token1)).toBe(true);
  });

  it('should handle missing tokens', () => {
    expect(hasInsufficientBalance('100', '100', null as unknown as Kong.Token, null as unknown as Kong.Token)).toBe(false);
  });
});

describe('getButtonText', () => {
  const token0 = { symbol: 'BTC' } as Kong.Token;
  const token1 = { symbol: 'USDT' } as Kong.Token;

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

describe('getPoolForTokenPair', () => {
  it('should find matching pools', () => {
    const token0 = { address: 'token0-id' } as Kong.Token;
    const token1 = { address: 'token1-id' } as Kong.Token;
    const pools = [
      { address_0: 'token0-id', address_1: 'token1-id' } as BE.Pool,
      { address_0: 'token2-id', address_1: 'token3-id' } as BE.Pool
    ];

    expect(getPoolForTokenPair(token0, token1, pools)).toBe(pools[0]);
    expect(getPoolForTokenPair(token1, token0, pools)).toBe(pools[0]); // Test reverse order
    expect(getPoolForTokenPair(null, token1, pools)).toBe(null);
    expect(getPoolForTokenPair(token0, token1, [])).toBe(null);
  });
});

describe('validateTokenSelect', () => {
  it('should validate token selection correctly', () => {
    const icp = { symbol: 'ICP', address: 'icp-id' } as Kong.Token;
    const ckusdt = { symbol: 'ckUSDT', address: 'ckusdt-id' } as Kong.Token;
    const btc = { symbol: 'BTC', address: 'btc-id' } as Kong.Token;
    const eth = { symbol: 'ETH', address: 'eth-id' } as Kong.Token;
    const tokens = [icp, ckusdt, btc, eth];
    const allowedTokens = ['ICP', 'ckUSDT'];
    
    // Valid: one token is in allowed list
    const result1 = validateTokenSelect(icp, btc, allowedTokens, 'ICP', tokens);
    expect(result1.isValid).toBe(true);
    expect(result1.newToken).toBe(icp);
    
    // Valid: both tokens are in allowed list
    const result2 = validateTokenSelect(icp, ckusdt, allowedTokens, 'ICP', tokens);
    expect(result2.isValid).toBe(true);
    expect(result2.newToken).toBe(icp);
    
    // Invalid: same token
    const result3 = validateTokenSelect(btc, btc, allowedTokens, 'ICP', tokens);
    expect(result3.isValid).toBe(false);
    expect(result3.newToken?.symbol).toBe('ICP');
    expect(result3.error).toBe('One token must be ICP or ckUSDT');
    
    // Invalid: neither token is in allowed list
    const result4 = validateTokenSelect(btc, eth, allowedTokens, 'ICP', tokens);
    expect(result4.isValid).toBe(false);
    expect(result4.newToken?.symbol).toBe('ICP');
    expect(result4.error).toBe('One token must be ICP or ckUSDT');
    
    // No other token selected yet
    const result5 = validateTokenSelect(icp, null, allowedTokens, 'ICP', tokens);
    expect(result5.isValid).toBe(true);
    expect(result5.newToken).toBe(icp);
  });
});

describe('calculateToken1FromPrice', () => {
  it('should calculate token1 amount based on token0 amount and price', () => {
    // 1 token0 at price 50000 should give 50000 token1
    expect(calculateToken1FromPrice('1', '50000')).toBe('50000');
    expect(calculateToken1FromPrice('2.5', '1000')).toBe('2500');
    expect(calculateToken1FromPrice('0', '1000')).toBe('0');
  });
  
  it('should handle invalid inputs', () => {
    expect(calculateToken1FromPrice('', '1000')).toBe('0');
    expect(calculateToken1FromPrice('1', '')).toBe('0');
    expect(calculateToken1FromPrice('invalid', '1000')).toBe('0');
    expect(calculateToken1FromPrice('1', 'invalid')).toBe('0');
  });
});

describe('calculateToken0FromPrice', () => {
  it('should calculate token0 amount based on token1 amount and price', () => {
    // 50000 token1 at price 50000 should give 1 token0
    expect(calculateToken0FromPrice('50000', '50000')).toBe('1');
    expect(calculateToken0FromPrice('2500', '1000')).toBe('2.5');
    expect(calculateToken0FromPrice('0', '1000')).toBe('0');
  });
  
  it('should handle invalid inputs', () => {
    expect(calculateToken0FromPrice('', '1000')).toBe('0');
    expect(calculateToken0FromPrice('1000', '')).toBe('0');
    expect(calculateToken0FromPrice('invalid', '1000')).toBe('0');
    expect(calculateToken0FromPrice('1000', 'invalid')).toBe('0');
  });
});

describe('calculateAmountFromPercentage', () => {
  it('should calculate token amount based on percentage of balance', () => {
    const token = { 
      decimals: 6,
      fee: 0.001 // 0.1%
    } as Kong.Token;
    
    // 50% of 1000 tokens should be 500
    expect(calculateAmountFromPercentage(token, '1000000000', 50)).toBe('500.000000');
    
    // 25% of 1000 tokens should be 250
    expect(calculateAmountFromPercentage(token, '1000000000', 25)).toBe('250.000000');
    
    // 100% of 1000 tokens should be 1000 minus 2x fee
    expect(calculateAmountFromPercentage(token, '1000000000', 100)).toBe('999.998000');
  });
  
  it('should handle edge cases', () => {
    const token = { 
      decimals: 6,
      fee: 0.001
    } as Kong.Token;
    
    expect(calculateAmountFromPercentage(token, '0', 50)).toBe('0');
    expect(calculateAmountFromPercentage(null as unknown as Kong.Token, '1000000000', 50)).toBe('0');
    expect(calculateAmountFromPercentage(token, '', 50)).toBe('0');
    
    // Balance less than fee
    expect(calculateAmountFromPercentage(token, '1000', 100)).toBe('0');
  });
});

describe('calculateTokenUsdValue', () => {
  it('should calculate USD value for a token amount', () => {
    const token = { 
      address: 'token-id',
      metrics: { price: '50000' }
    } as Kong.Token;
    
    // 1 token at price $50000 should be $50000
    expect(calculateTokenUsdValue('1', token)).toBe('50,000.00');
    
    // 0.5 token at price $50000 should be $25000
    expect(calculateTokenUsdValue('0.5', token)).toBe('25,000.00');
    
    // 0 token should be $0
    expect(calculateTokenUsdValue('0', token)).toBe('0');
  });
  
  it('should handle invalid inputs', () => {
    const token = { 
      address: 'token-id',
      metrics: { price: '50000' }
    } as Kong.Token;
    
    expect(calculateTokenUsdValue('', token)).toBe('0');
    expect(calculateTokenUsdValue('invalid', token)).toBe('0');
    expect(calculateTokenUsdValue('1', null)).toBe('0');
    
    const tokenWithoutPrice = { 
      address: 'token-id',
      metrics: {}
    } as Kong.Token;
    expect(calculateTokenUsdValue('1', tokenWithoutPrice)).toBe('0');
  });
});

describe('formatToNonZeroDecimal', () => {
  it('should format numbers with appropriate decimal places', () => {
    // Very small numbers should have 6 decimal places
    expect(formatToNonZeroDecimal(0.000123)).toBe('0.000123');
    
    // Small numbers should have 4 decimal places
    expect(formatToNonZeroDecimal(0.1234)).toBe('0.1234');
    
    // Regular numbers should have 2 decimal places
    expect(formatToNonZeroDecimal(123.456)).toBe('123.46');
    
    // Large numbers should have 2 decimal places and commas
    expect(formatToNonZeroDecimal(12345.67)).toBe('12,345.67');
    expect(formatToNonZeroDecimal(1234567.89)).toBe('1,234,567.89');
  });
  
  it('should handle edge cases', () => {
    expect(formatToNonZeroDecimal(0)).toBe('0');
    expect(formatToNonZeroDecimal(NaN)).toBe('0');
  });
}); 