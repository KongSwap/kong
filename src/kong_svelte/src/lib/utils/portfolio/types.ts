export interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
  tokenValue: number;
  lpValue: number;
  tokens: {
    canisterId: string;
    value: number;
    balance: string;
  }[];
  pools: {
    poolId: string;
    value: number;
    shares: string;
  }[];
}

export interface PortfolioStats {
  totalAssets: number;
  activePools: number;
  bestMonth: number;
  worstMonth: number;
}

export interface TokenPosition {
  label: string;
  balance: string;
  value: number;
  change: number;
  symbol: string;
  canisterId: string;
}

export interface TimeRange {
  label: '1W' | '1M' | '3M' | 'YTD' | '1Y';
  days: number;
}

export const TIME_RANGES: TimeRange[] = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: 'YTD', days: 365 }, // This will need to be calculated
  { label: '1Y', days: 365 }
]; 