export interface PortfolioPosition {
  label: string;
  balance: number;
}

export interface PortfolioMetrics {
  totalValue: number;
  dailyChange: number;  // 24h change in USD and percentage
  weeklyChange: number; // 7d change
  highestValue: number; // All-time or 30d high
  lowestValue: number;  // All-time or 30d low
  bestPerformer: {
    symbol: string;
    change: number;
  };
  worstPerformer: {
    symbol: string;
    change: number;
  };
}

export function processPortfolioData(tokens: any[], balances: any, userPools: any[]) {
  // Process token positions
  const tokenPositions = tokens.map(token => {
    const balance = balances[token.canister_id]?.in_usd || 0;
    const value = Number(balance);
    return {
      name: token.symbol,
      value: value,
      type: 'token'
    };
  }).filter(pos => pos.value > 0);

  // Process LP positions
  const lpPositions = userPools.map(pool => {
    const value = Number(pool.value_usd) || Number(pool.usd_balance) || 0;
    return {
      name: `${pool.symbol_0}/${pool.symbol_1} LP`,
      value: value,
      type: 'lp'
    };
  }).filter(pos => pos.value > 0);

  // Combine all positions and sort by value
  const allPositions = [...tokenPositions, ...lpPositions]
    .sort((a, b) => b.value - a.value);

  // Split into top positions and others
  const topPositions = allPositions.slice(0, 5);
  const otherPositions = allPositions.slice(5);

  // If there are other positions, sum them up
  const otherSum = otherPositions.reduce((sum, pos) => sum + pos.value, 0);
  if (otherSum > 0) {
    topPositions.push({
      name: 'Others',
      value: otherSum,
      type: 'other'
    });
  }

  return { topPositions, otherPositions };
}

export function createChartData(topPositions: any[], otherPositions: any[], colors: string[], borderColors: string[]) {
  return {
    labels: topPositions.map(pos => pos.name),
    datasets: [{
      data: topPositions.map(pos => pos.value),
      backgroundColor: colors.slice(0, topPositions.length),
      borderColor: borderColors.slice(0, topPositions.length),
      borderWidth: 1
    }]
  };
} 