import { CKUSDT_CANISTER_ID, CKUSDC_CANISTER_ID } from '$lib/constants/canisterConstants';

export interface PortfolioPosition {
  label: string;
  balance: number;
}

export interface PortfolioMetrics {
  totalValue: number;
  dailyChange: number;  // 24h change in USD and percentage
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

export function processPortfolioData(tokens: FE.Token[], balances: any, userPools: any[]) {
  // Log raw input data
  console.log('Raw userPools data:', userPools.map(pool => ({
    symbol_0: pool.symbol_0,
    symbol_1: pool.symbol_1,
    token_0_amount: pool.token_0_amount,
    token_1_amount: pool.token_1_amount,
    value: pool.value,
    raw: pool
  })));

  // Process token positions with metadata
  const tokenPositions = tokens.map(token => {
    const marketCap = Number(token.metrics?.market_cap || 0);
    const tvl = Number(token.metrics?.tvl || 0);
    const tvlRatio = marketCap > 0 ? (tvl / marketCap) * 100 : 0;
    
    // Check if token is a stablecoin by canister ID
    const isStablecoin = token.canister_id === CKUSDT_CANISTER_ID || 
                        token.canister_id === CKUSDC_CANISTER_ID;

    // Log token details for debugging
    console.log('Processing token:', {
      symbol: token.symbol,
      canisterId: token.canister_id,
      isStablecoin,
      value: Number(balances[token.canister_id]?.in_usd || 0)
    });
    
    return {
      symbol: token.symbol,
      value: Number(balances[token.canister_id]?.in_usd || 0),
      marketCap,
      percentage: 0, // Will be calculated later
      category: tvlRatio < 5 ? 'illiquid' : 'liquid',
      isStablecoin,
      tvlRatio
    };
  }).filter(pos => pos.value > 0);

  // Process LP positions with detailed metadata
  const lpPositions = userPools.map(pool => {
    const token0 = tokens.find(t => t.symbol === pool.symbol_0);
    const token1 = tokens.find(t => t.symbol === pool.symbol_1);
    
    // Log the raw pool object to see all available properties
    console.log('Raw pool object:', pool);
    
    // Calculate token values in USD
    const token0Amount = Number(pool.amount_0 || pool.token0_amount || pool.token_0_amount || 0);
    const token1Amount = Number(pool.amount_1 || pool.token1_amount || pool.token_1_amount || 0);
    const token0Price = Number(token0?.metrics?.price || 0);
    const token1Price = Number(token1?.metrics?.price || 0);
    
    const token0Value = token0Amount * token0Price;
    const token1Value = token1Amount * token1Price;
    const lpValue = Number(pool.value || (token0Value + token1Value));

    // Log raw values for debugging
    console.log('LP Token Details:', {
      symbol: `${pool.symbol_0}/${pool.symbol_1} LP`,
      token0Amount,
      token1Amount,
      token0Price,
      token1Price,
      token0Value,
      token1Value,
      lpValue,
      poolValue: pool.value,
      rawPool: {
        ...pool,
        amount_0: pool.amount_0,
        amount_1: pool.amount_1,
        token0_amount: pool.token0_amount,
        token1_amount: pool.token1_amount
      }
    });

    const poolTVL = Number(pool.tvl || 0);
    const token0MarketCap = Number(token0?.metrics?.market_cap || 0);
    const token1MarketCap = Number(token1?.metrics?.market_cap || 0);
    const token0TVL = Number(token0?.metrics?.tvl || 0);
    const token1TVL = Number(token1?.metrics?.tvl || 0);
    
    // Calculate TVL ratios for both tokens
    const token0TVLRatio = token0MarketCap > 0 ? (token0TVL / token0MarketCap) * 100 : 0;
    const token1TVLRatio = token1MarketCap > 0 ? (token1TVL / token1MarketCap) * 100 : 0;

    // Check if either token is a stablecoin
    const token0IsStable = token0?.canister_id === CKUSDT_CANISTER_ID || token0?.canister_id === CKUSDC_CANISTER_ID;
    const token1IsStable = token1?.canister_id === CKUSDT_CANISTER_ID || token1?.canister_id === CKUSDC_CANISTER_ID;

    // Log LP details for debugging
    console.log('Processing LP:', {
      symbol: `${pool.symbol_0}/${pool.symbol_1} LP`,
      token0: pool.symbol_0,
      token1: pool.symbol_1,
      token0Amount,
      token1Amount,
      token0Value,
      token1Value,
      lpValue,
      token0IsStable,
      token1IsStable
    });
    
    return {
      symbol: `${pool.symbol_0}/${pool.symbol_1} LP`,
      value: lpValue,
      protocol: pool.name,
      percentage: 0, // Will be calculated later
      category: token0TVLRatio < 10 || token1TVLRatio < 10 ? 'illiquid' : 'liquid',
      tvlRatio: (token0TVLRatio + token1TVLRatio) / 2, // Average TVL ratio of both tokens
      isStablecoin: token0IsStable || token1IsStable, // LP is considered stablecoin if either token is stable
      lpDetails: {
        token0: pool.symbol_0,
        token1: pool.symbol_1,
        poolTVL,
        token0MarketCap,
        token1MarketCap,
        token0Price,
        token1Price,
        feeTier: Number(pool.fee || 0.3),
        token0Balance: Number(pool.token_0_amount || 0),
        token1Balance: Number(pool.token_1_amount || 0),
        token0Value,
        token1Value,
        token0TVLRatio,
        token1TVLRatio
      }
    };
  }).filter(pos => pos.value > 0);

  const allPositions = [...tokenPositions, ...lpPositions];
  const totalValue = allPositions.reduce((sum, pos) => sum + pos.value, 0) || 1;

  // Calculate percentages
  allPositions.forEach(pos => {
    pos.percentage = (pos.value / totalValue) * 100;
  });

  // Log final positions for debugging
  console.log('Final positions:', {
    tokenCount: tokenPositions.length,
    lpCount: lpPositions.length,
    totalValue,
    positions: allPositions.map(p => ({
      symbol: p.symbol,
      value: p.value,
      isStablecoin: p.isStablecoin
    }))
  });

  return {
    topPositions: allPositions
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),
    otherPositions: allPositions
      .sort((a, b) => b.value - a.value)
      .slice(5)
  };
}

export function createChartData(topPositions: any[], otherPositions: any[], colors: string[], borderColors: string[]) {
  // Calculate total value of other positions
  const othersValue = otherPositions.reduce((sum, pos) => sum + pos.value, 0);
  
  // Only add Others category if there are other positions with value
  const labels = [...topPositions.map(pos => pos.symbol)];
  const values = [...topPositions.map(pos => pos.value)];
  
  if (othersValue > 0) {
    labels.push('Others');
    values.push(othersValue);
  }

  return {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors.slice(0, values.length),
      borderColor: borderColors.slice(0, values.length),
      borderWidth: 1
    }]
  };
} 