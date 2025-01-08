export interface PortfolioHistory {
  timestamp: number;
  totalValue: number;
  tokenValue: number;
  lpValue: number;
}

export const getPortfolioHistory = async (
  principal: string,
  days: number = 30
): Promise<PortfolioHistory[]> => {
  try {
    // This would ideally fetch from your backend
    // For now, return mock data with proper number of days
    const history: PortfolioHistory[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Generate one data point per day for the requested period
    for (let i = days; i >= 0; i--) {
      const timestamp = now - (i * dayMs);
      const baseValue = 10000 + Math.random() * 5000; // Random base value
      
      history.push({
        timestamp,
        totalValue: baseValue,
        tokenValue: baseValue * 0.8,  // 80% tokens
        lpValue: baseValue * 0.2      // 20% LP positions
      });
    }
    
    return history.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    return [];
  }
}; 