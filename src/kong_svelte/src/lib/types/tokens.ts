export interface TokenBalance {
  in_tokens: bigint;
  in_usd: string;
}

export interface Token {
  canister_id: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  price?: number;
  total_24h_volume?: bigint;
  pools?: any[];
  fee: bigint;
  icrc1: boolean;
  icrc2: boolean;
  token: string;
  token_id: number;
  chain: string;
  icrc3: boolean;
  on_kong: boolean;
  pool_symbol: string;
}

export interface TokenState {
  tokens: Token[];
  balances: Record<string, TokenBalance>;
  prices: Record<string, number>;
  favorites: Set<string>;
} 
