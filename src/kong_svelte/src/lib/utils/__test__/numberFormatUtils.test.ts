import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import {
  formatBalance,
  formatToNonZeroDecimal,
  parseTokenAmount,
} from '$lib/utils/numberFormatUtils';

describe('formatBalance', () => {
  it('should handle various input types', () => {
    expect(formatBalance('1000000', 6)).toBe('1');
    expect(formatBalance(1000000n, 6)).toBe('1');
    expect(formatBalance(new BigNumber('1000000'), 6)).toBe('1');
  });

  it('should handle zero values', () => {
    expect(formatBalance('0', 6)).toBe('0');
    expect(formatBalance(0n, 6)).toBe('0');
    expect(formatBalance(new BigNumber(0), 6)).toBe('0');
  });

  it('should format very small values with up to 8 decimals', () => {
    expect(formatBalance('1', 8)).toBe('0.00000001');
    expect(formatBalance('10', 8)).toBe('0.0000001');
  });

  it('should format small values with up to 6 decimals', () => {
    expect(formatBalance('1000', 8)).toBe('0.00001');
    expect(formatBalance('10000', 8)).toBe('0.0001');
  });

  it('should format normal values with up to 4 decimals and proper grouping', () => {
    expect(formatBalance('100000000000', 8)).toBe('1,000');
    expect(formatBalance('123456789000', 8)).toBe('1,234.5679');
  });
});

describe('formatToNonZeroDecimal', () => {
  it('should handle zero and empty inputs', () => {
    expect(formatToNonZeroDecimal(0)).toBe('0');
    expect(formatToNonZeroDecimal('')).toBe('0');
  });

  it('should format small numbers with appropriate decimals', () => {
    expect(formatToNonZeroDecimal(0.001)).toBe('0.001');
    expect(formatToNonZeroDecimal(0.00123)).toBe('0.00123');
  });

  it('should format regular numbers with 2 decimals', () => {
    expect(formatToNonZeroDecimal(1.23)).toBe('1.23');
    expect(formatToNonZeroDecimal(123.456)).toBe('123.46');
  });

  it('should handle string inputs', () => {
    expect(formatToNonZeroDecimal('0.001')).toBe('0.001');
    expect(formatToNonZeroDecimal('1.23')).toBe('1.23');
  });
});

describe('parseTokenAmount', () => {
  it('should handle various input types', () => {
    expect(parseTokenAmount('1', 6).toString()).toBe('1000000');
    expect(parseTokenAmount(1n, 6).toString()).toBe('1000000');
    expect(parseTokenAmount(new BigNumber(1), 6).toString()).toBe('1000000');
  });

  it('should handle empty or invalid inputs', () => {
    expect(parseTokenAmount('', 6).toString()).toBe('0');
    expect(parseTokenAmount('invalid', 6).toString()).toBe('0');
    expect(parseTokenAmount(NaN, 6).toString()).toBe('0');
  });

  it('should handle decimal inputs', () => {
    expect(parseTokenAmount('0.1', 6).toString()).toBe('100000');
    expect(parseTokenAmount('1.23456', 6).toString()).toBe('1234560');
  });

  it('should handle scientific notation', () => {
    expect(parseTokenAmount('1e-6', 6).toString()).toBe('1');
    expect(parseTokenAmount('1e6', 6).toString()).toBe('1000000000000');
  });

  it('should handle formatted numbers with commas', () => {
    expect(parseTokenAmount('1,000', 6).toString()).toBe('1000000000');
    expect(parseTokenAmount('1,234.56', 6).toString()).toBe('1234560000');
  });

  it('should handle edge cases', () => {
    // Test MAX_SAFE_INTEGER
    const maxSafeInt = BigInt(Number.MAX_SAFE_INTEGER);
    const maxResult = parseTokenAmount(maxSafeInt, 6);
    const expected = maxSafeInt * BigInt(10 ** 6);
    expect(maxResult).toBe(expected);
    expect(maxResult.toString()).not.toBe('0');

    // Test MIN_SAFE_INTEGER
    const minSafeInt = BigInt(Number.MIN_SAFE_INTEGER);
    const minResult = parseTokenAmount(minSafeInt, 6);
    const expectedMin = minSafeInt * BigInt(10 ** 6);
    expect(minResult).toBe(expectedMin);
    expect(minResult.toString()).not.toBe('0');

    // Test large number beyond MAX_SAFE_INTEGER
    const largeNum = BigInt(2) ** BigInt(60);
    const largeResult = parseTokenAmount(largeNum, 6);
    expect(largeResult.toString()).not.toBe('0');
    expect(largeResult).toBe(largeNum * BigInt(10 ** 6));

    // Test infinity cases
    expect(parseTokenAmount(Infinity, 6).toString()).toBe('0');
    expect(parseTokenAmount(-Infinity, 6).toString()).toBe('0');
  });
}); 