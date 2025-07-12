import type { Principal } from "@dfinity/principal";

// Core swap types
export interface SwapToken extends Kong.Token {
  // All properties inherited from Kong.Token
}

export interface SwapParams {
  payToken: SwapToken;
  payAmount: string;
  receiveToken: SwapToken;
  receiveAmount?: string;
  slippage: number;
  userAddress?: string;
}

export interface SwapQuote {
  receiveAmount: string;
  price: string;
  priceImpact: number;
  gasFees: SwapFee[];
  lpFees: SwapFee[];
  routingPath: RoutingHop[];
  timestamp: number;
}

export interface SwapFee {
  amount: string;
  token: string;
  tokenSymbol?: string;
}

export interface RoutingHop {
  paySymbol: string;
  receiveSymbol: string;
  poolSymbol: string;
  payAmount: string;
  receiveAmount: string;
  price: number;
}

export interface SwapExecuteParams {
  swapId: string;
  payToken: SwapToken;
  payAmount: string;
  receiveToken: SwapToken;
  receiveAmount: string;
  userMaxSlippage: number;
  backendPrincipal: Principal;
  lpFees: SwapFee[];
  needsAllowance?: boolean;
}

export interface SwapResult {
  success: boolean;
  data?: {
    txHash: string;
    payAmount: string;
    receiveAmount: string;
    timestamp: number;
  };
  error?: string;
  errors?: string[];
}

// Form related types
export interface SwapFormValues {
  payToken: SwapToken | null;
  payAmount: string;
  receiveToken: SwapToken | null;
  receiveAmount: string;
}

export interface SwapFormErrors {
  payToken?: string;
  payAmount?: string;
  receiveToken?: string;
  receiveAmount?: string;
  general?: string;
}

// State machine context
export interface SwapMachineContext {
  formValues: SwapFormValues;
  quote: SwapQuote | null;
  error: string | null;
  txHash: string | null;
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  data?: SwapParams;
  errors?: string[];
}

// Service response types
export interface QuoteRequest {
  payToken: SwapToken;
  payAmount: string;
  receiveToken: SwapToken;
}

export interface QuoteResponse {
  quote: SwapQuote;
  expiresAt: number;
}

// Event types for analytics
export interface SwapAnalyticsEvent {
  event: 'swap_initiated' | 'swap_completed' | 'swap_failed' | 'quote_requested';
  data: Record<string, any>;
  timestamp: number;
}

// Error types
export class SwapExecutionError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'SwapExecutionError';
  }
}

export class SwapValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'SwapValidationError';
  }
}

// Retry options
export interface RetryOptions {
  maxAttempts: number;
  backoff: 'exponential' | 'linear' | 'constant';
  initialDelay?: number;
  maxDelay?: number;
}