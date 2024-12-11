import { INDEXER_URL } from "../../constants/canisterConstants";

export async function fetchTransactions(tokenId: number, page: number, limit: number): Promise<FE.Transaction[]> {
  const url = `${INDEXER_URL}/api/tokens/${tokenId}/transactions?page=${page}&limit=${limit}&sort=timestamp&order=desc`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data.transactions || [];
} 