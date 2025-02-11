import { INDEXER_URL } from "$lib/api/index";
import { kongDB } from "../db";
import { DEFAULT_LOGOS } from "../tokens/tokenLogos";

interface TokensParams {
  page?: number;
  limit?: number;
  canisterIds?: string[];
}

export const fetchTokens = async (params?: TokensParams): Promise<FE.Token[]> => {
  try {
    const { page = 1, limit = 150, canisterIds } = params || {};
    
    // Build query string for pagination
    const queryString = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    }).toString();

    // Determine if we need to make a GET or POST request
    const options: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (canisterIds && canisterIds.length > 0) {
      // Use POST with body if we have canister IDs
      options.method = 'POST';
      options.body = JSON.stringify({ canister_ids: canisterIds });
    } else {
      // Use GET if no canister IDs
      options.method = 'GET';
    }

    const response = await fetch(
      `${INDEXER_URL}/api/tokens?${queryString}`,
      options
    );
   
    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tokens = data?.tokens || data;
    return await Promise.all(tokens.map(async (token) => {
      const existingToken = await kongDB.tokens.where('canister_id').equals(token.canister_id).first();
      return {
        ...token,
        metrics: {
          ...token.metrics,
          previous_price: existingToken?.metrics?.price || token.metrics.price,
          price: token.metrics.price,
          volume_24h: token.metrics.volume_24h,
          total_supply: token.metrics.total_supply,
          market_cap: token.metrics.market_cap,
          tvl: token.metrics.tvl,
          updated_at: token.metrics.updated_at,
          price_change_24h: token.metrics.price_change_24h
        },
        logo_url: token?.logo_url || DEFAULT_LOGOS[token.canister_id],
        address: token.address || token.canister_id,
        fee: Number(token.fee),
        fee_fixed: BigInt(token?.fee_fixed?.replaceAll("_", "") || "0").toString(),
        token: token.token_type || '',
        token_type: token.token_type || '',
        chain: token.token_type === 'IC' ? 'ICP' : token.chain || '',
        pool_symbol: token.pool_symbol ?? "Pool not found",
        pools: [],
      };
    }));
  } catch (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }
};

export interface CandleData {
  candle_start: number;
  open_price: string | number;
  high_price: string | number;
  low_price: string | number;
  close_price: string | number;
  volume: string | number;
}

export const fetchChartData = async (
  payTokenId: number,
  receiveTokenId: number,
  startTimestamp: number,
  endTimestamp: number,
  resolution: string
): Promise<CandleData[]> => {
  // Convert timestamps to ISO format
  const startTime = new Date(startTimestamp * 1000).toISOString();
  const endTime = new Date(endTimestamp * 1000).toISOString();
  
  const intervalMap: Record<string, string> = {
    '1m': '1',
    '5': '5',
    '15': '15',
    '30': '30',
    '60': '1h',
    '240': '4h',
    '1D': '1d',
    'D': '1d',
    '1W': '1w',
    'W': '1w'
  };
  const interval = intervalMap[resolution] || '1d';

  const url = `${INDEXER_URL}/api/swaps/ohlc?pay_token_id=${payTokenId}&receive_token_id=${receiveTokenId}&start_time=${startTime}&end_time=${endTime}&interval=${interval}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('API error:', data);
      return [];
    }
    
    // Parse and transform the data
    if (Array.isArray(data)) {
      return data.map(candle => {
        // Parse the ISO string to UTC timestamp in milliseconds
        const timestamp = Date.parse(candle.candle_start);
        
        return {
          candle_start: timestamp, // Store as milliseconds timestamp
          open_price: candle.open_price,
          high_price: candle.high_price,
          low_price: candle.low_price,
          close_price: candle.close_price,
          volume: candle.volume || 0
        };
      })
      .filter(candle => !isNaN(candle.candle_start)) // Remove any invalid timestamps
      .sort((a, b) => a.candle_start - b.candle_start); // Sort by timestamp
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return [];
  }
};

export interface Transaction {
  id: string;
  ts: string;
  requestId: string;
  status: string;
  txId: string;
  payAmount: string;
  receiveAmount: string;
  paySymbol: string;
  receiveSymbol: string;
  price: string;
  payChain: string;
  receiveChain: string;
  slippage: number;
  payToken: {
    symbol: string;
    decimals: number;
  };
  receiveToken: {
    symbol: string;
    decimals: number;
  };
}

export interface TransactionResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface PoolsResponse {
  pools: BE.Pool[];
  total_count: number;
}

export const fetchPools = async (): Promise<PoolsResponse> => {
  const url = `${INDEXER_URL}/api/pools`;
  const response = await fetch(url);
  const data = await response.json();
  return data || {};
};
