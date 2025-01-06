
export interface RiskMetrics {
  diversificationScore: number;  // 0-100
  volatilityScore: number;      // 0-100
  recommendations: string[];
}

export function calculateRiskMetrics(positions: any[]) {
  // Log incoming positions for debugging

  // Handle empty portfolio case
  if (!positions || positions.length === 0) {
    return {
      diversificationScore: 0,
      totalValue: 0
    };
  }

  // Calculate total portfolio value
  const totalValue = positions.reduce((sum, pos) => sum + (pos.value || 0), 0);

  // Handle zero total value case
  if (totalValue === 0) {
    return {
      diversificationScore: 0,
      totalValue: 0
    };
  }

  // Calculate concentration score (higher concentration = higher risk)
  const concentrationScore = positions.reduce((score, pos) => {
    const percentage = (pos.value || 0) / totalValue;
    return score + (percentage * percentage);
  }, 0);

  // Convert concentration to diversification (0-100 scale)
  const diversificationScore = Math.round((1 - Math.sqrt(concentrationScore)) * 100);

  return {
    diversificationScore: isNaN(diversificationScore) ? 0 : diversificationScore,
    totalValue
  };
} 