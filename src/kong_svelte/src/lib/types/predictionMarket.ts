import type { Principal } from '@dfinity/principal';

export type MarketCategory = 
  | { AI: null }
  | { Memes: null }
  | { Crypto: null }
  | { Other: null }
  | { Politics: null }
  | { KongMadness: null }
  | { Sports: null };

export type MarketStatus = 
  | { Disputed: null }
  | { Active: null }
  | { Closed: bigint[] }
  | { Voided: null }
  | { PendingActivation: null }
  | { ExpiredUnresolved: null };

export type ResolutionMethod = 
  | { Oracle: { oracle_principals: Principal[]; required_confirmations: bigint } }
  | { Decentralized: { quorum: bigint } }
  | { Admin: null };

export interface Market {
  id: bigint;
  bet_count_percentages: number[];
  status: MarketStatus;
  outcome_pools: bigint[];
  creator: Principal;
  outcome_percentages: number[];
  question: string;
  resolution_data?: string;
  created_at: bigint;
  end_time: bigint;
  total_pool: bigint;
  outcomes: string[];
  resolution_method: ResolutionMethod;
  token_id: string;
  category: MarketCategory;
  rules: string;
  uses_time_weighting: boolean;
  time_weight_alpha: number;
  token_id: string;
  image_url: string;
  featured: boolean;
  resolved_by?: Principal;
  bet_counts: bigint[];
  featured: boolean;
  uses_time_weighting: boolean;
  image_url?: string;
  time_weight_alpha?: number;
}

export interface Bet {
  market_id: bigint;
  user: Principal;
  timestamp: bigint;
  amount: bigint;
  outcome_index: bigint;
}

export interface BetWithMarket {
  bet: Bet;
  market: Market;
}

export interface MarketsByStatus {
  resolved: MarketResult[];
  active: Market[];
  expired_unresolved: Market[];
}

export interface MarketResult {
  bet_count_percentages: number[];
  outcome_pools: bigint[];
  outcome_percentages: number[];
  winning_pool: bigint;
  distributions: Distribution[];
  total_pool: bigint;
  market: Market;
  winning_outcomes: bigint[];
  bet_counts: bigint[];
}

export interface Distribution {
  bet_amount: bigint;
  winnings: bigint;
  user: Principal;
  outcome_index: bigint;
}

export interface UserBetInfo {
  outcome_text: string;
  bet_amount: bigint;
  winnings?: bigint;
  market: Market;
  outcome_index: bigint;
}

export interface UserHistory {
  pending_resolution: UserBetInfo[];
  total_wagered: bigint;
  current_balance: bigint;
  total_won: bigint;
  active_bets: UserBetInfo[];
  resolved_bets: UserBetInfo[];
} 

export interface TokenInfo {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  fee_percentage: bigint;
  is_kong: boolean;
  transfer_fee: bigint;
  activation_fee: bigint;
}