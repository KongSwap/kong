import { get } from 'svelte/store';
import { userTokens } from '$lib/stores/userTokens';
import { storedBalancesStore } from '$lib/services/tokens/tokenStore';

export interface PortfolioHistory {
  timestamp: number;
  totalValue: number;
  tokenValue: number;
  lpValue: number;
}

// Helper function to calculate current portfolio details using real token metrics
function getCurrentPortfolioDetails() {
  const tokensList = get(userTokens).tokens;
  const balances = get(storedBalancesStore);
  
  let tokenValue = 0;
  let tokenValue24h = 0;
  
  tokensList.forEach(token => {
    const balanceData = balances[token.canister_id];
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