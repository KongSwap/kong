import { get } from 'svelte/store';
import { walletDataStore } from '$lib/services/wallet';

export interface PortfolioHistory {
  timestamp: number;
  totalValue: number;
  tokenValue: number;
  lpValue: number;
}

// Helper function to calculate current portfolio details using real token metrics
function getCurrentPortfolioDetails() {
  const walletData = get(walletDataStore);
  
  if (!walletData || !walletData.tokens || !walletData.balances) {
    return { tokenValue: 0, lpValue: 0, tokenValue24h: 0, lpValue24h: 0 };
  }
  
  let tokenValue = 0;
  let tokenValue24h = 0;
  
  walletData.tokens.forEach(token => {
    const balanceData = walletData.balances?.[token.address];
    if (balanceData && token.metrics) {
      const currentValue = Number(balanceData.in_usd);
      const priceChange = parseFloat(token.metrics.price_change_24h) || 0;
      
      // Calculate the value 24h ago using the price change percentage
      const pastValue = currentValue / (1 + (priceChange / 100));
      
      tokenValue += currentValue;
      tokenValue24h += pastValue;
    }
  });
  
  // For LP positions, assuming no change for now
  const lpValue = 0;
  const lpValue24h = 0;
  
  return { tokenValue, lpValue, tokenValue24h, lpValue24h };
}

export const getPortfolioHistory = (
  principal: string,
  days: number = 30
): PortfolioHistory[] => {
  try {
    // Use real calculations instead of mock random data
    const details = getCurrentPortfolioDetails();
    const currentTimestamp = Date.now();
    const pastTimestamp = currentTimestamp - (24 * 60 * 60 * 1000); // 24 hours ago
    
    // Create snapshots only if we have valid values
    if (details.tokenValue === 0 && details.lpValue === 0) {
      return [];
    }
    
    // Current snapshot
    const currentSnapshot: PortfolioHistory = {
      timestamp: currentTimestamp,
      totalValue: details.tokenValue + details.lpValue,
      tokenValue: details.tokenValue,
      lpValue: details.lpValue
    };
    
    // 24h ago snapshot
    const pastSnapshot: PortfolioHistory = {
      timestamp: pastTimestamp,
      totalValue: details.tokenValue24h + details.lpValue24h,
      tokenValue: details.tokenValue24h,
      lpValue: details.lpValue24h
    };
    
    return [pastSnapshot, currentSnapshot];
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    return [];
  }
}; 