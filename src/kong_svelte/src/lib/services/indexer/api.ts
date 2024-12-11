import { INDEXER_URL } from "$lib/constants/canisterConstants";
import { kongDB } from "../db";
import { parseTokens } from "../tokens/tokenParsers";


export const fetchTokens = async (): Promise<FE.Token[]> => {
  try {
    const response = await fetch(`${INDEXER_URL}/api/tokens`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const parsed = parseTokens(data);
    await kongDB.tokens.bulkPut(parsed.map(token => ({
      ...token,
      timestamp: Date.now()
    })));
    return parsed;
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

export const fetchTransactions = async (
  poolId: number, 
  page: number = 0, 
  limit: number = 20
): Promise<Transaction[]> => {
  try {
    const url = `${INDEXER_URL}/api/pools/${poolId}/transactions?page=${page}&limit=${limit}`;
    console.log('Fetching transactions from URL:', url);
    
    const response = await fetch(url);
    const data: TransactionResponse = await response.json();
    
    if (!response.ok) {
      console.error('API error:', data);
      return [];
    }
    return data.transactions || []; // Return the transactions array from the response
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
  }
};
