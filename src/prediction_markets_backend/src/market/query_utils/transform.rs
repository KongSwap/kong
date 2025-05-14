//! # Market Transformation Utilities
//! 
//! This module provides utilities for transforming market data into various response formats,
//! calculating statistics such as outcome pools, percentages, and bet counts.

use candid::Nat;
use num_traits::ToPrimitive;

use crate::market::market::{Market, MarketResult, Distribution, MarketStatus};
use crate::nat::StorableNat;
use crate::stable_memory::*;
use crate::types::{MarketId, BetCount, TokenAmount};

/// Handles transformation of market data into appropriate response formats
#[derive(Default, Clone)]
pub struct MarketTransformer {
    /// Whether to calculate outcome pool statistics
    pub calculate_pools: bool,
    /// Whether to calculate bet count statistics
    pub calculate_bet_counts: bool,
    /// Whether to compute detailed distributions for resolved markets
    pub calculate_distributions: bool,
}

impl MarketTransformer {
    /// Create a new transformer with default settings
    pub fn new() -> Self {
        Self {
            calculate_pools: true,
            calculate_bet_counts: true,
            calculate_distributions: true,
        }
    }
    
    /// Disable pool calculations (for performance optimization)
    pub fn without_pools(mut self) -> Self {
        self.calculate_pools = false;
        self
    }
    
    /// Disable bet count calculations (for performance optimization)
    pub fn without_bet_counts(mut self) -> Self {
        self.calculate_bet_counts = false;
        self
    }
    
    /// Disable distribution calculations (for performance optimization)
    pub fn without_distributions(mut self) -> Self {
        self.calculate_distributions = false;
        self
    }
    
    /// Transform a market into its detailed view with pool and bet information
    pub fn transform_market(&self, market_id: MarketId, market: &Market) -> Market {
        let mut market = market.clone();

        if !self.calculate_pools && !self.calculate_bet_counts {
            return market;
        }
        
        // Calculate outcome pools and bet counts
        let mut outcome_pools = vec![0u64; market.outcomes.len()];
        let mut bet_counts = vec![BetCount::from(0u64); market.outcomes.len()];
        let mut total_bets = BetCount::from(0u64);
        
        BETS.with(|bets| {
            if let Some(bet_store) = bets.borrow().get(&market_id) {
                for bet in bet_store.0.iter() {
                    let outcome_idx = bet.outcome_index.to_u64() as usize;
                    
                    if self.calculate_pools {
                        outcome_pools[outcome_idx] = (TokenAmount::from(outcome_pools[outcome_idx]) + bet.amount.clone()).to_u64();
                    }
                    
                    if self.calculate_bet_counts {
                        bet_counts[outcome_idx] = bet_counts[outcome_idx].clone() + BetCount::from(1u64);
                        total_bets = total_bets.clone() + BetCount::from(1u64);
                    }
                }
            }
        });
        
        // Update market with calculated statistics
        if self.calculate_pools {
            // Convert outcome pools and calculate percentages
            let outcome_pools_clone = outcome_pools.clone();
            market.outcome_pools = outcome_pools.into_iter().map(StorableNat::from).collect();
            market.outcome_percentages = outcome_pools_clone
                .iter()
                .map(|&amount| {
                    if !market.total_pool.is_zero() {
                        amount as f64 / market.total_pool.to_f64() * 100.0
                    } else {
                        0.0
                    }
                })
                .collect();
        }
        
        if self.calculate_bet_counts {
            market.bet_counts = bet_counts.clone();
            market.bet_count_percentages = bet_counts
                .iter()
                .map(|count| {
                    if !total_bets.is_zero() {
                        count.to_f64() / total_bets.to_f64() * 100.0
                    } else {
                        0.0
                    }
                })
                .collect();
        }
        
        market
    }
    
    /// Transform a resolved market into a MarketResult with distributions
    pub fn transform_to_market_result(&self, market_id: MarketId, market: &Market) -> MarketResult {
        // Only applicable for closed markets
        if let MarketStatus::Closed(ref winning_outcomes) = market.status {
            // Calculate distributions for resolved markets
            let mut distributions = Vec::new();
            let mut total_winning_pool = StorableNat::from(0u64);
            let mut outcome_pools = vec![StorableNat::from(0u64); market.outcomes.len()];
            let mut bet_counts = vec![StorableNat::from(0u64); market.outcomes.len()];
            let mut total_bets = StorableNat::from(0u64);
            
            BETS.with(|bets| {
                if let Some(bet_store) = bets.borrow().get(&market_id) {
                    for bet in bet_store.0.iter() {
                        let outcome_idx = bet.outcome_index.to_u64() as usize;
                        
                        if self.calculate_pools {
                            outcome_pools[outcome_idx] = outcome_pools[outcome_idx].clone() + bet.amount.clone();
                        }
                        
                        if self.calculate_bet_counts {
                            bet_counts[outcome_idx] = bet_counts[outcome_idx].clone() + StorableNat::from_u64(1);
                            total_bets = total_bets.clone() + StorableNat::from_u64(1);
                        }
                        
                        if self.calculate_distributions && 
                           winning_outcomes.iter().any(|n| Nat::from(bet.outcome_index.clone()) == *n) {
                            total_winning_pool = total_winning_pool.clone() + bet.amount.clone();
                            distributions.push(Distribution {
                                user: bet.user,
                                outcome_index: bet.outcome_index.clone(),
                                bet_amount: bet.amount.clone(),
                                winnings: bet.amount.clone(), // Placeholder, actual winnings calculated below
                            });
                        }
                    }
                }
            });
            
            // Calculate actual winnings for each distribution
            if self.calculate_distributions && !total_winning_pool.is_zero() {
                for dist in distributions.iter_mut() {
                    dist.winnings = (dist.bet_amount.clone() * market.total_pool.clone()) / total_winning_pool.clone().to_u64();
                }
            }
            
            // Calculate percentages
            let outcome_percentages = if self.calculate_pools {
                outcome_pools.iter()
                    .map(|amount| {
                        if !market.total_pool.is_zero() {
                            amount.to_f64() / market.total_pool.to_f64() * 100.0
                        } else {
                            0.0
                        }
                    })
                    .collect()
            } else {
                vec![0.0; market.outcomes.len()]
            };
            
            let bet_count_percentages = if self.calculate_bet_counts {
                bet_counts.iter()
                    .map(|count| {
                        if !total_bets.is_zero() {
                            count.to_f64() / total_bets.to_f64() * 100.0
                        } else {
                            0.0
                        }
                    })
                    .collect()
            } else {
                vec![0.0; market.outcomes.len()]
            };
            
            MarketResult {
                market: market.clone(),
                winning_outcomes: winning_outcomes.iter().map(|n| StorableNat::from(n.0.to_u64().unwrap_or(0))).collect(),
                total_pool: market.total_pool.clone(),
                winning_pool: total_winning_pool,
                outcome_pools,
                outcome_percentages,
                bet_counts,
                bet_count_percentages,
                distributions,
            }
        } else {
            // For non-closed markets, create an empty MarketResult
            MarketResult {
                market: market.clone(),
                winning_outcomes: Vec::new(),
                total_pool: StorableNat::from(0u64),
                winning_pool: StorableNat::from(0u64),
                outcome_pools: vec![StorableNat::from(0u64); market.outcomes.len()],
                outcome_percentages: vec![0.0; market.outcomes.len()],
                bet_counts: vec![StorableNat::from(0u64); market.outcomes.len()],
                bet_count_percentages: vec![0.0; market.outcomes.len()],
                distributions: Vec::new(),
            }
        }
    }
    
    /// Calculate statistics for markets grouped by status (active, expired but unresolved, resolved)
    pub fn calculate_markets_by_status_stats(&self, markets: &[(MarketId, Market)]) -> (usize, usize, usize) {
        let now = ic_cdk::api::time();
        
        let mut total_active = 0;
        let mut total_expired_unresolved = 0;
        let mut total_resolved = 0;
        
        for (_, market) in markets {
            match market.status {
                MarketStatus::Active | MarketStatus::PendingActivation => {
                    if now < market.end_time.to_u64() {
                        total_active += 1;
                    } else {
                        total_expired_unresolved += 1;
                    }
                },
                MarketStatus::ExpiredUnresolved => {
                    total_expired_unresolved += 1;
                },
                MarketStatus::Disputed => {
                    total_expired_unresolved += 1;
                }
                MarketStatus::Closed(_) | MarketStatus::Voided => {
                    total_resolved += 1;
                }
            }
        }
        
        (total_active, total_expired_unresolved, total_resolved)
    }
}
