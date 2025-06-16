// BaseModel.ts
// Base model class with shared utility functions

export class BaseModel {
  /**
   * Safely converts a value to BigInt
   * @param value - The value to convert
   * @returns BigInt value or 0n if conversion fails
   */
  static toBigInt(value: unknown): bigint {
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
  static toNumber(value: unknown): number {
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
  static toString(value: unknown): string {
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
  static toBoolean(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    return Boolean(value);
  }

  /**
   * Safely formats a token amount by removing underscores and adjusting for decimals
   * @param amount - The amount to format
   * @param decimals - The number of decimals for the token
   * @returns Formatted amount as string
   */
  static formatTokenAmount(amount: unknown, decimals: number): string {
    if (amount === null || amount === undefined) return '0';
    
    try {
      const cleanAmount = this.toString(amount).replace(/_/g, '');
      if (!cleanAmount) return '0';
      
      return (Number(cleanAmount) / Math.pow(10, decimals)).toString();
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return '0';
    }
  }
} 