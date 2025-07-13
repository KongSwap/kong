import { SwapValidator } from './SwapValidator';
import { SwapService } from '$lib/services/swap/SwapService';
import { trackEvent, AnalyticsEvent } from '$lib/utils/analytics';
import type { 
  SwapParams, 
  SwapResult, 
  SwapExecuteParams,
  RetryOptions,
  SwapQuote
} from '../types/swap.types';
import { SwapExecutionError } from '../types/swap.types';
import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';
import { currentUserBalancesStore } from '$lib/stores/balancesStore';
import { AllowancePrecheck } from '$lib/services/icrc/AllowancePrecheck';
import { Principal } from '@dfinity/principal';
import { KONG_BACKEND_CANISTER_ID } from '$lib/constants/canisterConstants';
import BigNumber from 'bignumber.js';

export interface SwapOrchestratorOptions {
  signal?: AbortSignal;
}

export class SwapOrchestrator {
  private validator: SwapValidator;
  private quoteCache: Map<string, { quote: SwapQuote; timestamp: number }>;
  private readonly QUOTE_CACHE_TTL = 30000; // 30 seconds
  
  constructor() {
    this.validator = new SwapValidator();
    this.quoteCache = new Map();
  }

  /**
   * Get a quote for the swap
   */
  async getQuote(params: SwapParams, options: SwapOrchestratorOptions = {}): Promise<SwapQuote | null> {
    try {
      // Check if already aborted
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // Validate params first
      const validation = await this.validator.validate(params);
      if (!validation.isValid) {
        throw new Error(validation.errors?.join(', '));
      }

      // Check cache
      const cacheKey = this.getCacheKey(params);
      const cached = this.quoteCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.QUOTE_CACHE_TTL) {
        return cached.quote;
      }

      // Create a promise that will reject on abort
      const abortPromise = new Promise<never>((_, reject) => {
        if (options.signal) {
          const onAbort = () => {
            reject(new DOMException('Aborted', 'AbortError'));
          };
          
          if (options.signal.aborted) {
            onAbort();
          } else {
            options.signal.addEventListener('abort', onAbort, { once: true });
          }
        }
      });

      // Race between the quote request and abort
      const quoteResult = await Promise.race([
        SwapService.getSwapQuote(
          params.payToken,
          params.receiveToken,
          params.payAmount
        ),
        abortPromise
      ]);

      // Check again if aborted before processing result
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const quote: SwapQuote = {
        receiveAmount: quoteResult.receiveAmount,
        price: '0', // Calculate from amounts
        priceImpact: quoteResult.slippage,
        gasFees: quoteResult.gasFees,
        lpFees: quoteResult.lpFees,
        routingPath: quoteResult.routingPath,
        timestamp: Date.now()
      };

      // Cache the quote only if not aborted
      if (!options.signal?.aborted) {
        this.quoteCache.set(cacheKey, { quote, timestamp: Date.now() });
      }

      return quote;
    } catch (error) {
      // Don't log or track abort errors
      if (error.name === 'AbortError') {
        throw error;
      }
      
      console.error('Failed to get quote:', error);
      trackEvent(AnalyticsEvent.SwapFailed, {
        step: 'quote',
        error: error.message,
        ...params
      });
      throw error;
    }
  }

  /**
   * Execute swap with comprehensive error handling and retry logic
   */
  async executeSwap(params: SwapParams, options: SwapOrchestratorOptions = {}): Promise<SwapResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Validate parameters
      const validation = await this.validator.validate(params);
      if (!validation.isValid) {
        return { 
          success: false, 
          errors: validation.errors 
        };
      }

      // Step 2: Check user authentication
      const authState = get(auth);
      if (!authState.isConnected) {
        return { 
          success: false, 
          error: 'Wallet not connected' 
        };
      }

      // Step 3: Validate balance
      const balances = get(currentUserBalancesStore);
      const balanceData = balances?.[params.payToken.address];
      const userBalance = balanceData ? 
        new BigNumber(balanceData.in_tokens.toString())
          .div(new BigNumber(10).pow(params.payToken.decimals))
          .toString() : '0';
      
      const balanceValidation = await this.validator.validateBalance(
        params,
        userBalance,
        true // Include approval fee for ICRC-2 tokens
      );
      
      if (!balanceValidation.isValid) {
        return { 
          success: false, 
          errors: balanceValidation.errors 
        };
      }

      // Step 4: Get fresh quote
      const quote = await this.getQuote(params, options);
      if (!quote) {
        return { 
          success: false, 
          error: 'Failed to get swap quote' 
        };
      }

      // Step 5: Validate quote freshness and slippage
      const quoteFreshness = this.validator.validateQuoteFreshness(quote.timestamp);
      if (!quoteFreshness.isValid) {
        return { 
          success: false, 
          errors: quoteFreshness.errors 
        };
      }

      const slippageValidation = this.validator.validateSlippage(
        params.slippage,
        quote.priceImpact
      );
      
      if (!slippageValidation.isValid) {
        return { 
          success: false, 
          errors: slippageValidation.errors 
        };
      }

      // Step 6: Track swap initiation
      trackEvent(AnalyticsEvent.SwapCompleted, {
        payToken: params.payToken.symbol,
        receiveToken: params.receiveToken.symbol,
        payAmount: params.payAmount,
        expectedReceiveAmount: quote.receiveAmount,
        slippage: quote.priceImpact
      });

      // Step 7: Execute swap with retry logic
      const result = await this.executeWithRetry(
        async () => {
          // Check allowance for ICRC-2 tokens
          let needsAllowance = false;
          if (params.payToken.standards.includes('ICRC-2')) {
            const hasAllowance = await AllowancePrecheck.checkAllowanceOnly({
              token: params.payToken,
              amount: SwapService.toBigInt(params.payAmount, params.payToken.decimals)
            });
            needsAllowance = !hasAllowance;
          }

          // Create execute params
          const executeParams: SwapExecuteParams = {
            swapId: `swap-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            payToken: params.payToken,
            payAmount: params.payAmount,
            receiveToken: params.receiveToken,
            receiveAmount: quote.receiveAmount,
            userMaxSlippage: params.slippage,
            backendPrincipal: Principal.fromText(KONG_BACKEND_CANISTER_ID!),
            lpFees: quote.lpFees,
            needsAllowance
          };

          const txResult = await SwapService.executeSwap(executeParams);
          
          if (typeof txResult !== 'bigint') {
            throw new Error('Swap execution failed');
          }

          return {
            txHash: txResult.toString(),
            payAmount: params.payAmount,
            receiveAmount: quote.receiveAmount,
            timestamp: Date.now()
          };
        },
        {
          maxAttempts: 3,
          backoff: 'exponential'
        }
      );

      // Step 8: Track success
      const duration = Date.now() - startTime;
      trackEvent(AnalyticsEvent.SwapCompleted, {
        ...params,
        actualReceiveAmount: result.receiveAmount,
        txHash: result.txHash,
        duration_ms: duration
      });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      // Track failure
      trackEvent(AnalyticsEvent.SwapFailed, {
        ...params,
        error: error.message,
        duration_ms: Date.now() - startTime
      });

      return { 
        success: false, 
        error: this.normalizeError(error) 
      };
    }
  }

  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt < options.maxAttempts) {
          const delay = this.calculateBackoff(attempt, options);
          await this.sleep(delay);
        }
      }
    }
    
    throw new SwapExecutionError(
      `Failed after ${options.maxAttempts} attempts`,
      lastError!
    );
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(attempt: number, options: RetryOptions): number {
    const baseDelay = options.initialDelay || 1000;
    const maxDelay = options.maxDelay || 30000;
    
    switch (options.backoff) {
      case 'exponential':
        return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      case 'linear':
        return Math.min(baseDelay * attempt, maxDelay);
      default:
        return baseDelay;
    }
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    
    const nonRetryableErrors = [
      'insufficient balance',
      'insufficient funds',
      'wallet not connected',
      'user rejected',
      'cancelled',
      'invalid token',
      'same token'
    ];
    
    return nonRetryableErrors.some(err => message.includes(err));
  }

  /**
   * Normalize error messages for user display
   */
  private normalizeError(error: any): string {
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('InsufficientFunds')) {
        return 'Insufficient balance for this transaction';
      }
      if (error.message.includes('User rejected')) {
        return 'Transaction cancelled by user';
      }
      if (error.message.includes('Network')) {
        return 'Network error. Please try again.';
      }
      
      return error.message;
    }
    
    return 'An unexpected error occurred';
  }

  /**
   * Generate cache key for quotes
   */
  private getCacheKey(params: SwapParams): string {
    return `${params.payToken.address}-${params.receiveToken.address}-${params.payAmount}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear quote cache
   */
  clearCache(): void {
    this.quoteCache.clear();
  }

  /**
   * Get validator instance (for testing)
   */
  getValidator(): SwapValidator {
    return this.validator;
  }
}