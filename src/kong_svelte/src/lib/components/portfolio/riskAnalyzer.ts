import type { PortfolioPosition } from './portfolioDataProcessor';

export interface RiskMetrics {
  diversificationScore: number;  // 0-100
  volatilityScore: number;      // 0-100
  recommendations: string[];
}

// Calculate diversification score based on position distribution
const calculateDiversificationScore = (positions: PortfolioPosition[]): number => {
  if (positions.length === 0) return 0;
  
  // Calculate total portfolio value
  const totalValue = positions.reduce((sum, pos) => sum + pos.balance, 0);
  
  // Calculate concentration using Herfindahl-Hirschman Index (HHI)
  const hhi = positions.reduce((sum, pos) => {
    const weight = pos.balance / totalValue;
    return sum + (weight * weight);
  }, 0);
  
  // Convert HHI to a 0-100 score (inverted, as lower HHI means better diversification)
  // HHI ranges from 1/n (perfect diversification) to 1 (complete concentration)
  const minHHI = 1 / positions.length;
  const normalizedScore = ((1 - hhi) / (1 - minHHI)) * 100;
  
  return Math.round(normalizedScore);
};

// Calculate volatility score based on price changes
const calculateVolatilityScore = (positions: PortfolioPosition[]): number => {
  // For now, return a simplified score based on number of assets
  // In a real implementation, you'd want to use historical price data
  const baseScore = Math.min(positions.length * 10, 100);
  return Math.round(baseScore);
};

// Generate portfolio recommendations
const generateRecommendations = (
  diversificationScore: number,
  volatilityScore: number,
  positions: PortfolioPosition[]
): string[] => {
  const recommendations: string[] = [];

  // Diversification recommendations
  if (diversificationScore < 30) {
    recommendations.push("Consider diversifying your portfolio across more assets");
  } else if (diversificationScore < 60) {
    recommendations.push("Your portfolio could benefit from additional diversification");
  }

  // Position size recommendations
  if (positions.length > 0) {
    const largestPosition = positions[0];
    const totalValue = positions.reduce((sum, pos) => sum + pos.balance, 0);
    const largestWeight = (largestPosition.balance / totalValue) * 100;
    
    if (largestWeight > 50) {
      recommendations.push(`Consider reducing exposure to ${largestPosition.label} (${largestWeight.toFixed(1)}% of portfolio)`);
    }
  }

  // Add general recommendation if none specific
  if (recommendations.length === 0) {
    recommendations.push("Your portfolio appears well-balanced");
  }

  return recommendations;
};

export const calculateRiskMetrics = (
  positions: PortfolioPosition[]
): RiskMetrics => {
  const diversificationScore = calculateDiversificationScore(positions);
  const volatilityScore = calculateVolatilityScore(positions);
  const recommendations = generateRecommendations(
    diversificationScore,
    volatilityScore,
    positions
  );

  return {
    diversificationScore,
    volatilityScore,
    recommendations
  };
}; 