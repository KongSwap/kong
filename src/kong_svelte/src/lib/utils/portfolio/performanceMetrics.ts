import type { PortfolioHistory } from '$lib/utils/portfolio/portfolioHistory';
import { get } from 'svelte/store';
import { currentUserBalancesStore } from '$lib/stores/tokenStore';

export interface PerformanceMetrics {
  dailyChange: number;
  weeklyChange: number;
  monthlyChange: number;
  bestPerformer: {
    symbol: string;
    change: number;
  };
  worstPerformer: {
    symbol: string;
    change: number;
  };
}

const calculatePercentageChange = (newValue: number, oldValue: number): number => {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
};

export const calculatePerformanceMetrics = (
  history: PortfolioHistory[],
  tokens: FE.Token[]
): PerformanceMetrics => {
  // Sort history by timestamp to ensure correct ordering
  const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
  
  // For 24h change, we should have exactly 2 points - 24h ago and now
  const currentValue = sortedHistory[sortedHistory.length - 1]?.totalValue ?? 0;
  const dayAgoValue = sortedHistory[0]?.totalValue ?? currentValue;
  
  // Calculate daily change
  const dailyChange = calculatePercentageChange(currentValue, dayAgoValue);
  
  // Filter tokens to only include ones the user actually owns
  const balances = get(currentUserBalancesStore);
  const ownedTokens = tokens.filter(t => {
    const balance = balances[t.canister_id];
    return balance && Number(balance.in_usd) > 0;
  });
  
  // Find best and worst performing tokens among owned tokens based on tokens' 24hr percent change
  const performers = ownedTokens
    .filter(t => t.metrics?.price_change_24h && !isNaN(Number(t.metrics.price_change_24h)))
    .map(t => ({
      symbol: t.symbol,
      change: Number(t.metrics.price_change_24h)
    }))
    .sort((a, b) => b.change - a.change);
  
  return {
    dailyChange: Number(dailyChange.toFixed(2)),
    weeklyChange: 0, // We only have 24h data now
    monthlyChange: 0, // We only have 24h data now
    bestPerformer: performers[0] || { symbol: '', change: 0 },
    worstPerformer: performers[performers.length - 1] || { symbol: '', change: 0 }
  };
}; 