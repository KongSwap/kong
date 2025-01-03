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

export const processPortfolioData = (
  tokens: FE.Token[],
  balances: { [canister_id: string]: TokenBalance },
  userPools: UserPoolBalance[]
) => {
  // Process token balances
  const tokenData = tokens
    .filter(token => {
      const balance = balances[token.canister_id]?.in_usd;
      const numBalance = typeof balance === 'string' 
        ? Number(balance)
        : Number(balance);
      return balance && balance !== '0' && !isNaN(numBalance);
    })
    .map(token => ({
      label: token.symbol,
      balance: typeof balances[token.canister_id]?.in_usd === 'string'
        ? Number(balances[token.canister_id].in_usd)
        : Number(balances[token.canister_id]?.in_usd || 0)
    }));

  // Process pool positions
  const poolData = userPools
    .filter(pool => pool.usd_balance && Number(pool.usd_balance) > 0)
    .map(pool => ({
      label: `${pool.symbol_0}/${pool.symbol_1} LP`,
      balance: Number(pool.usd_balance)
    }));

  // Combine and sort data
  const combinedData = [...tokenData, ...poolData]
    .sort((a, b) => b.balance - a.balance);

  return {
    topPositions: combinedData.slice(0, 5),
    otherPositions: combinedData.slice(5)
  };
};

export const createChartData = (
  topPositions: PortfolioPosition[],
  otherPositions: PortfolioPosition[],
  colors: string[],
  borderColors: string[]
) => {
  const otherSum = otherPositions.reduce((sum, item) => sum + item.balance, 0);
  
  const labels = [
    ...topPositions.map(item => item.label),
    ...(otherPositions.length > 0 ? ['Others'] : [])
  ];
  
  const data = [
    ...topPositions.map(item => item.balance),
    ...(otherPositions.length > 0 ? [otherSum] : [])
  ];

  return {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.slice(0, labels.length),
      borderColor: borderColors.slice(0, labels.length),
      borderWidth: 1
    }]
  };
}; 