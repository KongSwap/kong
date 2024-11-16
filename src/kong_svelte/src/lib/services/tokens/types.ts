export interface TokenState {
  tokens: FE.Token[];
  balances: Record<string, FE.TokenBalance>;
  prices: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  totalValueUsd: string;
  lastTokensFetch: number | null;
  activeSwaps: Record<string, any>;
  favoriteTokens: Record<string, string[]>;
}

export interface FavoriteToken {
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
