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
