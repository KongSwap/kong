import { INDEXER_URL } from "$lib/constants/canisterConstants";
import { kongDB } from "../db";
import { liveQuery } from "dexie";

export interface IndexerToken {
  id: bigint;
  type: 'TOKEN' | 'LP_TOKEN';
  symbol: string;
  name: string;
  address: string;
  chain: string;
  txFee: string;
  supportedStandards: string[];
  metrics: IndexerTokenMetrics;
  kongBackendTokenId: string;
  decimals: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexerTokenMetrics {
  id: bigint;
  tokenId: bigint;
  totalSupply?: string | null;
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  lastUpdated: Date;
}

export const tokens = liveQuery(
  () => kongDB.indexedTokens.toArray()
);

export const fetchTokens = async (): Promise<IndexerToken[]> => {
  const response = await fetch(`${INDEXER_URL}/tokens`);
  const data = await response.json();

  kongDB.indexedTokens.bulkPut(data);
  return data;
};

export interface CandleData {
  timestamp: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
}

export const fetchChartData = async (
  poolId: number, 
  startTimestamp: number, 
  endTimestamp: number,
  resolution: string
): Promise<CandleData[]> => {
  // make start 2 years ago in epoch time
  startTimestamp = Math.floor(Date.now() / 1000) - (2 * 365 * 24 * 60 * 60);
  const url = `${INDEXER_URL}/pools/candlesticks/${poolId}?from=${startTimestamp}&to=${endTimestamp}&resolution=${resolution}`;
  console.log('Fetching chart data from URL:', url);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (!response.ok) {
    console.error('API error:', data);
    return [];
  }
  return data;
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
  page: number = 1, 
  limit: number = 20
): Promise<Transaction[]> => {
  try {
    const url = `${INDEXER_URL}/pools/${poolId}/transactions?page=${page}&limit=${limit}`;
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