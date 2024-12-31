import { describe, it, expect } from 'vitest';
import {
  formatUsdValue,
  formatTokenValue,
  toRawAmount,
  fromRawAmount,
} from '$lib/utils/tokenFormatters';

describe('formatUsdValue', () => {
  it('should handle falsy values', () => {
    expect(formatUsdValue(0)).toBe('$0.00');
    expect(formatUsdValue('')).toBe('$0.00');
    expect(formatUsdValue(undefined as any)).toBe('$0.00');
  });

  it('should format extremely small values in scientific notation', () => {
    expect(formatUsdValue(0.000001)).toBe('< $0.01');
  });

  it('should format very small values with up to 6 decimals', () => {
    expect(formatUsdValue(0.001234)).toBe('$0.001234');
  });

  it('should format small values with up to 4 decimals', () => {
    expect(formatUsdValue(0.1234)).toBe('$0.1234');
  });

  it('should format normal values with 2 decimals', () => {
    expect(formatUsdValue(1.2345)).toBe('$1.23');
    expect(formatUsdValue(123.456)).toBe('$123.46');
  });

  it('should format large values with K suffix', () => {
    expect(formatUsdValue(1234)).toBe('$1.23K');
    expect(formatUsdValue(12345)).toBe('$12.35K');
  });

  it('should format larger values with M suffix', () => {
    expect(formatUsdValue(1234567)).toBe('$1.23M');
    expect(formatUsdValue(12345678)).toBe('$12.35M');
  });

  it('should format very large values with B suffix', () => {
    expect(formatUsdValue(1234567890)).toBe('$1.23B');
    expect(formatUsdValue(12345678901)).toBe('$12.35B');
  });

  it('should handle string inputs with commas', () => {
    expect(formatUsdValue('1,234.56')).toBe('$1.23K');
    expect(formatUsdValue('1,234,567.89')).toBe('$1.23M');
  });
});

describe('formatTokenValue', () => {
  it('should handle missing inputs', () => {
    expect(formatTokenValue('0', undefined)).toBe('$0.00');
    expect(formatTokenValue('', 1)).toBe('$0.00');
  });

  it('should format token values correctly', () => {
    expect(formatTokenValue('100000000', 1)).toBe('$1.00'); // 1 token at $1
    expect(formatTokenValue('100000000', 1000)).toBe('$1K'); // 1 token at $1000
    expect(formatTokenValue('1000000000', 1)).toBe('$10.00'); // 10 tokens at $1
  });

  it('should handle custom decimals', () => {
    expect(formatTokenValue('1000000', 1, 6)).toBe('$1.00');
    expect(formatTokenValue('1000', 1, 3)).toBe('$1.00');
  });
});

describe('toRawAmount', () => {
  it('should handle falsy inputs', () => {
    expect(toRawAmount('')).toBe('0');
    expect(toRawAmount(0)).toBe('0');
  });

  it('should convert human amounts to raw amounts', () => {
    expect(toRawAmount('1')).toBe('100000000'); // 8 decimals
    expect(toRawAmount(1)).toBe('100000000');
    expect(toRawAmount('0.1')).toBe('10000000');
    expect(toRawAmount('0.00000001')).toBe('1');
  });

  it('should handle custom decimals', () => {
    expect(toRawAmount('1', 6)).toBe('1000000');
    expect(toRawAmount('1', 3)).toBe('1000');
  });
});

describe('fromRawAmount', () => {
  it('should handle falsy inputs', () => {
    expect(fromRawAmount('')).toBe(0);
    expect(fromRawAmount('0')).toBe(0);
  });

  it('should convert raw amounts to human readable numbers', () => {
    expect(fromRawAmount('100000000')).toBe(1); // 8 decimals
    expect(fromRawAmount('10000000')).toBe(0.1);
    expect(fromRawAmount('1')).toBe(0.00000001);
  });

  it('should handle custom decimals', () => {
    expect(fromRawAmount('1000000', 6)).toBe(1);
    expect(fromRawAmount('1000', 3)).toBe(1);
  });
}); 