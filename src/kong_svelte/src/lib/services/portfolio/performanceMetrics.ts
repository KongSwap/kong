import type { PortfolioHistory } from './portfolioHistory';
import type { FE } from '$lib/types';

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

const findValueAtTime = (history: PortfolioHistory[], hoursAgo: number): number | null => {
  if (!history.length) return null;
  
  const targetTime = Date.now() - (hoursAgo * 60 * 60 * 1000);
  
  // Find the closest data point to our target time
  return history.reduce((closest, current) => {
    if (!closest) return current;
    
    const currentDiff = Math.abs(current.timestamp - targetTime);
    const closestDiff = Math.abs(closest.timestamp - targetTime);
    
    return currentDiff < closestDiff ? current : closest;
  }, null as PortfolioHistory | null)?.totalValue ?? null;
};

export const calculatePerformanceMetrics = (
  history: PortfolioHistory[],
  tokens: FE.Token[]
): PerformanceMetrics => {
  // Sort history by timestamp to ensure correct ordering
  const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
  
  const currentValue = sortedHistory[sortedHistory.length - 1]?.totalValue ?? 0;
  
  // Find values at different time periods
  const dayAgoValue = findValueAtTime(sortedHistory, 24) ?? currentValue;
  const weekAgoValue = findValueAtTime(sortedHistory, 24 * 7) ?? currentValue;
  const monthAgoValue = findValueAtTime(sortedHistory, 24 * 30) ?? currentValue;
  
  // Calculate changes
  const dailyChange = calculatePercentageChange(currentValue, dayAgoValue);
  const weeklyChange = calculatePercentageChange(currentValue, weekAgoValue);
  const monthlyChange = calculatePercentageChange(currentValue, monthAgoValue);
  
  // Find best and worst performing tokens
  const performers = tokens
    .filter(t => t.metrics?.price_change_24h && !isNaN(Number(t.metrics.price_change_24h)))
    .map(t => ({
      symbol: t.symbol,
      change: Number(t.metrics.price_change_24h)
    }))
    .sort((a, b) => b.change - a.change);
  
  return {
    dailyChange: Number(dailyChange.toFixed(2)),
    weeklyChange: Number(weeklyChange.toFixed(2)),
    monthlyChange: Number(monthlyChange.toFixed(2)),
    bestPerformer: performers[0] || { symbol: '', change: 0 },
    worstPerformer: performers[performers.length - 1] || { symbol: '', change: 0 }
  };
}; 