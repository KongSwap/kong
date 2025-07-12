import { z } from 'zod';
import type { ValidationResult, SwapParams, SwapToken } from '../types/swap.types';
import BigNumber from 'bignumber.js';

export class SwapValidator {
  private schema = z.object({
    payToken: z.object({
      address: z.string().min(1, 'Pay token address is required'),
      decimals: z.number().positive('Decimals must be positive'),
      symbol: z.string().min(1, 'Token symbol is required'),
      standards: z.array(z.string()),
      fee_fixed: z.string(),
    }),
    receiveToken: z.object({
      address: z.string().min(1, 'Receive token address is required'),
      decimals: z.number().positive('Decimals must be positive'),
      symbol: z.string().min(1, 'Token symbol is required'),
      standards: z.array(z.string()),
      fee_fixed: z.string(),
    }),
    payAmount: z.string().refine(val => {
      if (!val || val === '') return false;
      const num = new BigNumber(val);
      return num.isFinite() && num.gt(0);
    }, 'Amount must be a positive number'),
    slippage: z.number()
      .min(0, 'Slippage cannot be negative')
      .max(50, 'Slippage cannot exceed 50%'),
  });

  // Blocked tokens that should not be traded
  private readonly BLOCKED_TOKENS = new Set<string>([
    // Add any blocked token addresses here
  ]);

  // Minimum amounts for different token types (in token units)
  private readonly MIN_AMOUNTS: Record<string, string> = {
    'ICP': '0.00001',
    'ckBTC': '0.00000001',
    'ckETH': '0.000001',
    'DEFAULT': '0.000001',
  };

  async validate(params: unknown): Promise<ValidationResult> {
    try {
      // First, validate the schema
      const validated = await this.schema.parseAsync(params);
      
      // Perform additional business logic validation
      const errors = await this.performBusinessValidation(validated);
      
      if (errors.length > 0) {
        return {
          isValid: false,
          errors,
        };
      }
      
      return { 
        isValid: true, 
        data: validated as SwapParams,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => e.message),
        };
      }
      
      return {
        isValid: false,
        errors: ['An unexpected validation error occurred'],
      };
    }
  }

  private async performBusinessValidation(params: any): Promise<string[]> {
    const errors: string[] = [];
    
    // Check if tokens are the same
    if (params.payToken.address === params.receiveToken.address) {
      errors.push('Cannot swap the same token');
    }
    
    // Check if tokens are blocked
    if (this.BLOCKED_TOKENS.has(params.payToken.address)) {
      errors.push(`${params.payToken.symbol} is temporarily unavailable for trading`);
    }
    
    if (this.BLOCKED_TOKENS.has(params.receiveToken.address)) {
      errors.push(`${params.receiveToken.symbol} is temporarily unavailable for trading`);
    }
    
    // Validate minimum amount
    const minAmount = this.getMinimumAmount(params.payToken.symbol);
    const payAmount = new BigNumber(params.payAmount);
    
    if (payAmount.lt(minAmount)) {
      errors.push(`Minimum amount for ${params.payToken.symbol} is ${minAmount}`);
    }
    
    // Validate maximum decimals
    const maxDecimals = params.payToken.decimals;
    const decimalPlaces = this.countDecimalPlaces(params.payAmount);
    
    if (decimalPlaces > maxDecimals) {
      errors.push(`${params.payToken.symbol} supports maximum ${maxDecimals} decimal places`);
    }
    
    // Validate amount is not too large (prevent overflow)
    const maxSafeAmount = new BigNumber('1e18'); // Reasonable max for most tokens
    if (payAmount.gt(maxSafeAmount)) {
      errors.push('Amount is too large');
    }
    
    return errors;
  }

  private getMinimumAmount(tokenSymbol: string): string {
    return this.MIN_AMOUNTS[tokenSymbol] || this.MIN_AMOUNTS.DEFAULT;
  }

  private countDecimalPlaces(value: string): number {
    const parts = value.split('.');
    return parts.length > 1 ? parts[1].length : 0;
  }

  // Validate balance sufficiency
  async validateBalance(
    params: SwapParams, 
    userBalance: string,
    includeApprovalFee: boolean = false
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    
    try {
      const balance = new BigNumber(userBalance);
      const amount = new BigNumber(params.payAmount);
      
      // Calculate total required including fees
      let totalRequired = amount;
      
      if (includeApprovalFee && params.payToken.standards.includes('ICRC-2')) {
        const approvalFee = new BigNumber(params.payToken.fee_fixed)
          .div(new BigNumber(10).pow(params.payToken.decimals));
        totalRequired = totalRequired.plus(approvalFee);
      }
      
      if (balance.lt(totalRequired)) {
        errors.push('Insufficient balance for this transaction');
      }
      
      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Failed to validate balance'],
      };
    }
  }

  // Validate slippage tolerance
  validateSlippage(userSlippage: number, calculatedSlippage: number): ValidationResult {
    if (calculatedSlippage > userSlippage) {
      return {
        isValid: false,
        errors: [`Price impact (${calculatedSlippage.toFixed(2)}%) exceeds your slippage tolerance (${userSlippage}%)`],
      };
    }
    
    // Warn for high slippage
    if (calculatedSlippage > 5) {
      return {
        isValid: true,
        errors: [`Warning: High price impact of ${calculatedSlippage.toFixed(2)}%`],
      };
    }
    
    return { isValid: true };
  }

  // Validate quote freshness
  validateQuoteFreshness(quoteTimestamp: number, maxAgeMs: number = 30000): ValidationResult {
    const age = Date.now() - quoteTimestamp;
    
    if (age > maxAgeMs) {
      return {
        isValid: false,
        errors: ['Quote has expired. Please refresh and try again.'],
      };
    }
    
    return { isValid: true };
  }

  // Check if amount needs reformatting
  formatAmount(amount: string, decimals: number): string {
    try {
      const bn = new BigNumber(amount);
      
      // Remove trailing zeros and limit decimal places
      return bn.toFixed(decimals).replace(/\.?0+$/, '');
    } catch {
      return amount;
    }
  }

  // Validate principal address format
  validatePrincipalAddress(address: string): boolean {
    try {
      // Basic validation - could be enhanced with Principal parsing
      return address.length > 0 && !address.includes(' ');
    } catch {
      return false;
    }
  }
}