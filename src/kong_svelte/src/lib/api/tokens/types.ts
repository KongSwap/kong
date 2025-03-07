import type { PaginationParams, PaginatedApiResponse } from '../base/types';

/**
 * Token API request parameters
 */
export interface TokensParams extends PaginationParams {
  search?: string;
  canister_id?: string;
}

/**
 * Raw token data from API
 */
export interface RawTokenData {
  canister_id: string;
  name: string;
  symbol: string;
  decimals: number;
  address?: string;
  fee?: number;
  fee_fixed?: string;
  token?: string;
  token_type?: string;
  chain?: string;
  pool_symbol?: string;
  pools?: any[];
  logo_url?: string;
  icrc1?: boolean;
  icrc2?: boolean;
  icrc3?: boolean;
  metrics?: {
    price?: string;
    volume_24h?: string;
    total_supply?: string;
    market_cap?: string;
    tvl?: string;
    updated_at?: string;
    price_change_24h?: string;
  };
}

/**
 * Token API response
 */
export interface TokensResponse extends PaginatedApiResponse<RawTokenData> {}

/**
 * Processed token response with serialized tokens
 */
export interface ProcessedTokensResponse {
  tokens: FE.Token[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * Request for fetching tokens by canister IDs
 */
export interface TokensByCanisterRequest {
  canister_ids: string[];
}

/**
 * Response for fetching tokens by canister IDs
 */
export interface TokensByCanisterResponse {
  items: RawTokenData[];
} 