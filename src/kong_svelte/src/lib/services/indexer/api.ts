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
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const fetchChartData = async (
  poolId: number, 
  startTimestamp: number, 
  endTimestamp: number,
  resolution: string
): Promise<CandleData[]> => {
  const response = await fetch(
    `${INDEXER_URL}/pools/candlesticks/${poolId}?from=${startTimestamp}&to=${endTimestamp}&resolution=${resolution}`
  );
  const data = await response.json();
  return data;
};