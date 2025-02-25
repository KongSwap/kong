import { CKUSDT_CANISTER_ID, CKUSDC_CANISTER_ID } from '$lib/constants/canisterConstants';

interface PositionAnalysis {
  symbol: string;
  value: number;
  percentage: number;
  category?: string;
  isStablecoin?: boolean;
  lpDetails?: {
    token0: string;
    token1: string;
    feeTier: number;
    token0Balance: number;
    token1Balance: number;
    token0Price: number;
    token1Price: number;
    poolTVL: number;
    token0MarketCap: number;
    token1MarketCap: number;
    token0TVLRatio: number;
    token1TVLRatio: number;
    token0Value: number;
    token1Value: number;
  };
  tvlRatio: number;
}

export interface RiskMetrics {
  diversificationScore: number;
  protocolConcentration: number;
  stablecoinPercentage: number;
  topPositionRisk: number;
  liquidityRisk: number;
  recommendations: string[];
  totalValue: number;
}

export function calculateRiskMetrics(positions: PositionAnalysis[]) {
  const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0) || 1;
  if (totalValue === 0) return {
    diversificationScore: 100,
    protocolConcentration: 0,
    stablecoinPercentage: 0,
    topPositionRisk: 0,
    liquidityRisk: 0,
    recommendations: ['No portfolio value detected'],
    totalValue
  };
  const positionCount = positions.length;

  // Calculate basic metrics
  const metrics: RiskMetrics = {
    diversificationScore: 0,
    protocolConcentration: 0,
    stablecoinPercentage: 0,
    topPositionRisk: 0,
    liquidityRisk: 0,
    recommendations: [],
    totalValue
  };

  // Helper function to check if a token is a stablecoin by symbol
  const isStablecoin = (symbol: string) => 
    symbol === 'ckUSDT' || symbol === 'ckUSDC';

  // Log all positions for debugging
  console.log('All positions:', positions.map(pos => ({
    symbol: pos.symbol,
    value: pos.value,
    isStablecoin: pos.isStablecoin,
    lpDetails: pos.lpDetails ? {
      token0: pos.lpDetails.token0,
      token1: pos.lpDetails.token1,
      token0Balance: pos.lpDetails.token0Balance,
      token1Balance: pos.lpDetails.token1Balance,
      token0Price: pos.lpDetails.token0Price,
      token1Price: pos.lpDetails.token1Price
    } : null
  })));

  // Stablecoin exposure
  const stablecoinValue = positions.reduce((sum, pos) => {
    // Log each position being processed
    console.log('Processing position:', {
      symbol: pos.symbol,
      value: pos.value,
      isStablecoin: pos.isStablecoin,
      lpDetails: pos.lpDetails ? {
        token0: pos.lpDetails.token0,
        token1: pos.lpDetails.token1,
        token0Value: pos.lpDetails.token0Value,
        token1Value: pos.lpDetails.token1Value
      } : null
    });

    if (pos.isStablecoin) {
      if (pos.lpDetails) {
        // For LP positions, sum up the value of stablecoin tokens
        const { token0, token1, token0Value, token1Value } = pos.lpDetails;
        let stableValue = 0;
        
        if (isStablecoin(token0)) {
          console.log(`Found stablecoin ${token0} in LP, value: ${token0Value}`);
          stableValue += token0Value;
        }
        if (isStablecoin(token1)) {
          console.log(`Found stablecoin ${token1} in LP, value: ${token1Value}`);
          stableValue += token1Value;
        }
        
        console.log(`Total stablecoin value in LP ${pos.symbol}: ${stableValue}`);
        return sum + stableValue;
      } else {
        // For direct stablecoin holdings
        console.log('Found direct stablecoin:', pos.symbol, pos.value);
        return sum + pos.value;
      }
    }
    return sum;
  }, 0);
  
  // Log total stablecoin exposure
  console.log('Total stablecoin exposure:', {
    stablecoinValue,
    totalValue,
    percentage: (stablecoinValue / totalValue) * 100
  });
  
  metrics.stablecoinPercentage = (stablecoinValue / totalValue) * 100;

  // Top position risk (as a 0-1 value)
  const sortedPositions = [...positions].sort((a, b) => b.value - a.value);
  metrics.topPositionRisk = Math.min(1, sortedPositions.slice(0, 3)
    .reduce((sum, pos) => sum + (pos.value / totalValue), 0));

  // Liquidity risk (check for illiquid assets)
  const illiquidAssets = positions.filter(pos => {
    // Check category first (based on TVL ratio)
    if (pos.category === 'illiquid') return true;
    
    // For LP positions, check additional liquidity criteria
    if (pos.lpDetails) {
      const { token0TVLRatio, token1TVLRatio } = pos.lpDetails;
      
      // Consider LP illiquid if either token has low TVL ratio
      return token0TVLRatio < 10 || token1TVLRatio < 10;
    }
    
    return false;
  });

  const illiquidValue = illiquidAssets.reduce((sum, pos) => sum + pos.value, 0);
  metrics.liquidityRisk = (illiquidValue / totalValue) * 100;

  // Log for debugging
  console.log('Liquidity Risk Analysis:', {
    totalValue,
    illiquidAssetsCount: illiquidAssets.length,
    illiquidAssets: illiquidAssets.map(a => ({
      symbol: a.symbol,
      value: a.value,
      category: a.category,
      tvlRatio: a.tvlRatio,
      lpDetails: a.lpDetails ? {
        token0TVLRatio: a.lpDetails.token0TVLRatio,
        token1TVLRatio: a.lpDetails.token1TVLRatio
      } : null
    })),
    illiquidValue,
    calculatedRisk: metrics.liquidityRisk
  });

  // Calculate overall diversification score (0-100)
  const diversificationPenalties = [
    metrics.topPositionRisk * 40,      // Top position concentration penalty
    metrics.liquidityRisk * 0.4,       // Liquidity risk penalty
    positionCount < 5 ? (5 - positionCount) * 5 : 0 // Small portfolio penalty
  ];

  metrics.diversificationScore = Number((Math.max(0, Math.min(100,
    100 - diversificationPenalties.reduce((sum, penalty) => sum + penalty, 0)
  ))).toFixed(1));

  // Generate recommendations
  const recommendations = new Set<string>();

  // Stablecoin balance
  if (metrics.stablecoinPercentage < 10) {
    recommendations.add(`Current stablecoin allocation is ${metrics.stablecoinPercentage.toFixed(1)}%. Maintain at least 10-20% in stablecoins to manage volatility risk`);
  } else if (metrics.stablecoinPercentage > 50) {
    recommendations.add(`High stablecoin allocation (${metrics.stablecoinPercentage.toFixed(1)}%) may limit growth potential. Consider productive assets`);
  }

  // Top positions
  sortedPositions.slice(0, 3).forEach((pos, index) => {
    const perc = (pos.value / totalValue * 100).toFixed(1);
    if (pos.percentage > 30) {
      recommendations.add(`Reduce ${pos.symbol} allocation (${perc}%) to under 30% for better diversification`);
    }
  });

  // LP-specific checks
  positions.filter(pos => pos.lpDetails).forEach(pos => {
    const lp = pos.lpDetails!;
    if (calculateImpermanentLoss(pos) > 0.15) {
      recommendations.add(`Review ${pos.symbol} (${lp.token0}/${lp.token1}) LP position - high impermanent loss risk`);
    }
    if (lp.feeTier < 0.3) {
      recommendations.add(`Consider higher fee tier pools for ${lp.token0}/${lp.token1} to improve returns`);
    }
  });

  // Illiquid assets
  if (metrics.liquidityRisk > 25) {
    const illiquidDetails = illiquidAssets
      .map(asset => {
        const tvlInfo = asset.lpDetails 
          ? `(${asset.lpDetails.token0}: ${asset.lpDetails.token0TVLRatio.toFixed(1)}% TVL, ${asset.lpDetails.token1}: ${asset.lpDetails.token1TVLRatio.toFixed(1)}% TVL)`
          : `(${asset.tvlRatio.toFixed(1)}% TVL)`;
        return `${asset.symbol} $${asset.value.toFixed(2)} ${tvlInfo}`;
      });
    recommendations.add(`High exposure to illiquid assets (${metrics.liquidityRisk.toFixed(1)}%): ${illiquidDetails.join(', ')}. Consider reducing these positions.`);
  }

  metrics.recommendations = Array.from(recommendations);

  return { ...metrics, totalValue };
}

function calculateImpermanentLoss(pos: PositionAnalysis) {
  if (!pos.lpDetails) return 0;
  
  // Get current price ratio
  const currentRatio = pos.lpDetails.token0Price / pos.lpDetails.token1Price;
  
  // Get initial price ratio from pool balances
  const initialRatio = pos.lpDetails.token0Balance / pos.lpDetails.token1Balance;
  
  // Standard IL formula
  const sqrtRatio = Math.sqrt(currentRatio / initialRatio);
  return (2 * sqrtRatio / (1 + currentRatio / initialRatio) - 1) * 100;
}

export function calculateStablecoinExposure(positions: any[]): { stablecoinValue: number; totalValue: number; percentage: number } {
  console.log('All positions:', positions);
  
  let stablecoinValue = 0;
  let totalValue = 0;

  positions.forEach(position => {
    const value = Number(position.value || 0);
    totalValue += value;

    console.log('Processing position:', {
      symbol: position.symbol,
      value: value,
      isStablecoin: position.isStablecoin
    });

    if (position.isStablecoin) {
      if (position.lpDetails) {
        // For LP positions with stablecoins, count half the value as stablecoin exposure
        stablecoinValue += value / 2;
      } else {
        // For direct stablecoin holdings, count full value
        stablecoinValue += value;
      }
    }
  });

  const percentage = totalValue > 0 ? (stablecoinValue / totalValue) * 100 : 0;

  console.log('Total stablecoin exposure:', {
    stablecoinValue,
    totalValue,
    percentage
  });

  return {
    stablecoinValue,
    totalValue,
    percentage
  };
} 