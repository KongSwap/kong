export interface TokenState {
  balances: Record<string, FE.TokenBalance>;
  isLoading: boolean;
  error: Error | null;
  lastTokensFetch: Date | null;
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
