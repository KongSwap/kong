import { INDEXER_URL } from "$lib/constants/canisterConstants";

export interface Transaction {
  mid_price: number;
  pay_amount: number;
  pay_token_id: number;
  price: number;
  receive_amount: number;
  receive_token_id: number;
  timestamp?: string;
  ts?: string;
  tx_id?: string;
  user: {
    principal_id: string;
  };
}

export async function fetchTransactions(poolId: number, page: number = 1, limit: number = 20): Promise<Transaction[]> {
  try {
    const response = await fetch(`${INDEXER_URL}/api/pools/${poolId}/transactions?page=${page}&limit=${limit}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.transactions || [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
} 