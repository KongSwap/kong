export interface TokenState {
  activeSwaps: Record<string, any>;
  pendingBalanceRequests: Set<string>;
}

export interface FavoriteToken {
  id?: number;
  wallet_id: string;
  canister_id: string;
  timestamp: number;
}

export interface KongImage {
  id?: number;
  canister_id?: string;
  image_url?: string;
  timestamp: number;
}

export interface TokenBalance {
  wallet_id: string;
  canister_id: string;
  in_tokens: bigint;
  in_usd: string;
  timestamp: number;
}
