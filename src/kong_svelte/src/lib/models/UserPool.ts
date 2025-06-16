// UserPool.ts
// Model for user pool data with pool share calculations including fees

import { BaseModel } from './BaseModel';
import { BigNumber } from 'bignumber.js';

export interface UserPoolData {
  // Basic pool info
  id: string;
  name: string;
  symbol: string;
  symbol_0: string;
  symbol_1: string;
  address_0: string;
  address_1: string;
  chain_0: string;
  chain_1: string;
  
  // User balances
  balance: number; // LP token balance
  amount_0: number; // Token 0 amount
  amount_1: number; // Token 1 amount
  usd_balance: number;
  usd_amount_0: number;
  usd_amount_1: number;
  
  // Pool share calculations
  poolSharePercentage: number; // Percentage including fees
  userFeeShare0: number; // User's share of token 0 fees
  userFeeShare1: number; // User's share of token 1 fees
  totalFeesEarnedUSD: number; // Total USD value of fees earned
  
  // LP token info
  lp_token_id: string;
  lp_token_symbol: string;
  
  // Additional metadata
  ts: bigint;
  token0?: Kong.Token;
  token1?: Kong.Token;
  rolling_24h_apy?: number;
  rolling_24h_volume?: string;
  searchableText?: string;
}

export class UserPool extends BaseModel {
  /**
   * Parses user pool data with calculated pool share including fees
   */
  static parse(
    rawPool: unknown, 
    tokens?: Record<string, Kong.Token>,
    poolsData?: BE.Pool[]
  ): UserPoolData {
    if (!rawPool || typeof rawPool !== 'object') {
      throw new Error('Invalid pool data');
    }
    
    const pool = rawPool as Record<string, unknown>;
    
    // Basic pool data
    const id = `${pool.address_0}_${pool.address_1}`;
    const balance = this.toNumber(pool.balance); // LP token balance
    const amount_0 = this.toNumber(pool.amount_0);
    const amount_1 = this.toNumber(pool.amount_1);
    const address_0 = this.toString(pool.address_0);
    const address_1 = this.toString(pool.address_1);
    
    // Get the corresponding pool data for calculations
    const actualPool = poolsData?.find((p) => 
      p.address_0 === address_0 && p.address_1 === address_1
    );
    
    // Calculate pool share percentage and fees
    const {
      poolSharePercentage,
      userFeeShare0,
      userFeeShare1,
      totalFeesEarnedUSD
    } = this.calculatePoolShareWithFees(
      balance,
      amount_0,
      amount_1,
      actualPool,
      tokens?.[address_0],
      tokens?.[address_1]
    );
    
    return {
      id,
      name: this.toString(pool.name),
      symbol: this.toString(pool.symbol),
      symbol_0: this.toString(pool.symbol_0),
      symbol_1: this.toString(pool.symbol_1),
      address_0,
      address_1,
      chain_0: this.toString(pool.chain_0),
      chain_1: this.toString(pool.chain_1),
      
      balance,
      amount_0,
      amount_1,
      usd_balance: this.toNumber(pool.usd_balance),
      usd_amount_0: this.toNumber(pool.usd_amount_0),
      usd_amount_1: this.toNumber(pool.usd_amount_1),
      
      poolSharePercentage,
      userFeeShare0,
      userFeeShare1,
      totalFeesEarnedUSD,
      
      lp_token_id: this.toString(pool.lp_token_id),
      lp_token_symbol: this.toString(pool.lp_token_symbol || pool.symbol),
      
      ts: this.toBigInt(pool.ts),
      token0: tokens?.[address_0],
      token1: tokens?.[address_1],
      rolling_24h_apy: actualPool?.rolling_24h_apy ? parseFloat(actualPool.rolling_24h_apy) : undefined,
      rolling_24h_volume: actualPool?.rolling_24h_volume?.toString()
    };
  }
  
  /**
   * Calculates pool share percentage including fees
   */
  private static calculatePoolShareWithFees(
    userLPBalance: number,
    userAmount0: number,
    userAmount1: number,
    actualPool: BE.Pool | undefined,
    token0?: Kong.Token,
    token1?: Kong.Token
  ): {
    poolSharePercentage: number;
    userFeeShare0: number;
    userFeeShare1: number;
    totalFeesEarnedUSD: number;
  } {
    if (!actualPool) {
      return {
        poolSharePercentage: 0,
        userFeeShare0: 0,
        userFeeShare1: 0,
        totalFeesEarnedUSD: 0
      };
    }
    
    // Try LP token approach first (most accurate as it includes fees)
    if (userLPBalance && actualPool.lp_token_supply) {
      const percentage = this.calculateLPTokenPercentage(
        userLPBalance,
        actualPool.lp_token_supply
      );
      
      
      if (percentage > 0) {
        // Calculate user's share of fees based on LP token percentage
        const userFeeShare0 = this.calculateUserFeeShare(actualPool.lp_fee_0, percentage);
        const userFeeShare1 = this.calculateUserFeeShare(actualPool.lp_fee_1, percentage);
        const totalFeesEarnedUSD = this.calculateTotalFeesUSD(
          userFeeShare0,
          userFeeShare1,
          token0,
          token1
        );
        
        return {
          poolSharePercentage: percentage,
          userFeeShare0,
          userFeeShare1,
          totalFeesEarnedUSD
        };
      }
    }
    
    // Fallback: Calculate based on token amounts
    // Important: User amounts and pool balances don't include fees
    // Fees are tracked separately and not added to balances until withdrawal
    const poolSharePercentage = this.calculatePreliminaryPercentage(
      userAmount0,
      userAmount1,
      actualPool
    );
    
    // Calculate user's share of fees based on their pool percentage
    const userFeeShare0 = this.calculateUserFeeShare(actualPool.lp_fee_0, poolSharePercentage);
    const userFeeShare1 = this.calculateUserFeeShare(actualPool.lp_fee_1, poolSharePercentage);
    
    const totalFeesEarnedUSD = this.calculateTotalFeesUSD(
      userFeeShare0,
      userFeeShare1,
      token0,
      token1
    );
    
    return {
      poolSharePercentage,
      userFeeShare0,
      userFeeShare1,
      totalFeesEarnedUSD
    };
  }
  
  /**
   * Calculate percentage using LP tokens
   */
  private static calculateLPTokenPercentage(
    userLPBalance: number,
    totalLPSupply: bigint,
    lpTokenDecimals: number = 8
  ): number {
    try {
      const userLPBalanceBN = new BigNumber(userLPBalance);
      const totalLPSupplyBN = new BigNumber(totalLPSupply.toString()).dividedBy(
        new BigNumber(10).pow(lpTokenDecimals)
      );
      
      if (totalLPSupplyBN.isZero()) return 0;
      
      const percentage = userLPBalanceBN.div(totalLPSupplyBN).times(100);
      
      // Ensure percentage doesn't exceed 100% due to rounding
      return Math.min(percentage.toNumber(), 100);
    } catch (error) {
      console.error('Error calculating LP token percentage:', error);
      return 0;
    }
  }
  
  /**
   * Calculate pool share percentage based on token balances
   */
  private static calculatePreliminaryPercentage(
    userAmount0: number,
    userAmount1: number,
    pool: BE.Pool
  ): number {
    if (!pool.balance_0 || !pool.balance_1) return 0;
    
    const poolBalance0 = Number(pool.balance_0);
    const poolBalance1 = Number(pool.balance_1);
    
    if (poolBalance0 === 0 || poolBalance1 === 0) return 0;
    
    const percentage0 = (userAmount0 / poolBalance0) * 100;
    const percentage1 = (userAmount1 / poolBalance1) * 100;
    
    const averagePercentage = (percentage0 + percentage1) / 2;
    
    // Cap at 100% to handle rounding errors
    return Math.min(averagePercentage, 100);
  }
  
  
  /**
   * Calculate user's share of fees
   */
  private static calculateUserFeeShare(
    totalFee: bigint | undefined,
    userPercentage: number
  ): number {
    if (!totalFee || userPercentage === 0) return 0;
    return (Number(totalFee) * userPercentage) / 100;
  }
  
  /**
   * Calculate total USD value of fees
   */
  private static calculateTotalFeesUSD(
    feeAmount0: number,
    feeAmount1: number,
    token0?: Kong.Token,
    token1?: Kong.Token
  ): number {
    let totalUSD = 0;
    
    if (token0?.metrics?.price && feeAmount0 > 0) {
      const fee0Decimal = feeAmount0 / Math.pow(10, token0.decimals || 8);
      totalUSD += fee0Decimal * parseFloat(token0.metrics.price);
    }
    
    if (token1?.metrics?.price && feeAmount1 > 0) {
      const fee1Decimal = feeAmount1 / Math.pow(10, token1.decimals || 8);
      totalUSD += fee1Decimal * parseFloat(token1.metrics.price);
    }
    
    return totalUSD;
  }
  
  /**
   * Parse multiple user pools
   */
  static parseMultiple(
    rawPools: unknown[],
    tokens?: Record<string, Kong.Token>,
    poolsData?: BE.Pool[]
  ): UserPoolData[] {
    return rawPools.map(pool => this.parse(pool, tokens, poolsData));
  }
}