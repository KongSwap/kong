export interface TokenBalance {
  in_tokens: bigint;
  in_usd: string;
}

export interface TokenState {
  tokens: FE.Token[];
  balances: Record<string, TokenBalance>;
  prices: Record<string, number>;
  favorites: Set<string>;
} 
