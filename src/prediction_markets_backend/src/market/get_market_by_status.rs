use ic_cdk::query;
use num_traits::ToPrimitive;

use super::market::*;

use crate::nat::*;
use crate::stable_memory::*;

/// Get markets grouped by their status: active, expired but unresolved, and resolved
#[query]
pub fn get_markets_by_status() -> MarketsByStatus {
    let current_time = ic_cdk::api::time();

    MARKETS.with(|markets| {
        let markets = markets.borrow();
        let mut result = MarketsByStatus {
            active: Vec::new(),
            expired_unresolved: Vec::new(),
            resolved: Vec::new(),
        };

        for (market_id, market) in markets.iter() {
            match market.status {
                MarketStatus::Open => {
                    // Get bet distribution for the market
                    let mut outcome_pools = vec![StorableNat::from(0u64); market.outcomes.len()];
                    BETS.with(|bets| {
                        if let Some(bet_store) = bets.borrow().get(&market_id) {
                            for bet in bet_store.0.iter() {
                                let outcome_idx = bet.outcome_index.to_u64() as usize;
                                outcome_pools[outcome_idx] = outcome_pools[outcome_idx].clone() + bet.amount.clone();
                            }
                        }
                    });

                    // Create a modified market with outcome pool information
                    let mut market = market.clone();
                    market.rules = String::new(); // Remove rules as they're not relevant in this context

                    if StorableNat::from(current_time) < market.end_time {
                        result.active.push(market);
                    } else {
                        result.expired_unresolved.push(market);
                    }
                }
                MarketStatus::Disputed => {
                    // Add disputed markets to expired_unresolved since they need admin attention
                    let mut market = market.clone();
                    market.rules = String::new(); // Remove rules as they're not relevant in this context
                    result.expired_unresolved.push(market);
                }
                MarketStatus::Closed(ref winning_outcomes) => {
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
                                outcome_pools[outcome_idx] = outcome_pools[outcome_idx].clone() + bet.amount.clone();
                                bet_counts[outcome_idx] = bet_counts[outcome_idx].clone() + StorableNat::from_u64(1);
                                total_bets = total_bets.clone() + StorableNat::from_u64(1);

                                if winning_outcomes.iter().any(|n| candid::Nat::from(bet.outcome_index.clone()) == *n) {
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
                    if !total_winning_pool.is_zero() {
                        for dist in distributions.iter_mut() {
                            dist.winnings = (dist.bet_amount.clone() * market.total_pool.clone()) / total_winning_pool.clone().to_u64();
                        }
                    }

                    // Calculate percentages
                    let outcome_pools_clone = outcome_pools.clone();
                    let outcome_percentages = outcome_pools_clone
                        .iter()
                        .map(|amount| {
                            if !market.total_pool.is_zero() {
                                amount.to_f64() / market.total_pool.to_f64() * 100.0
                            } else {
                                0.0
                            }
                        })
                        .collect();

                    let bet_count_percentages = bet_counts
                        .iter()
                        .map(|count| {
                            if !total_bets.is_zero() {
                                count.to_f64() / total_bets.to_f64() * 100.0
                            } else {
                                0.0
                            }
                        })
                        .collect();

                    let mut market = market.clone();
                    market.rules = String::new(); // Remove rules as they're not relevant in this context

                    result.resolved.push(MarketResult {
                        market: market.clone(),
                        winning_outcomes: winning_outcomes
                            .iter()
                            .map(|n| StorableNat::from(n.0.to_u64().unwrap_or(0)))
                            .collect(),
                        total_pool: market.total_pool.clone(),
                        winning_pool: total_winning_pool,
                        outcome_pools,
                        outcome_percentages,
                        bet_counts,
                        bet_count_percentages,
                        distributions,
                    });
                }
            }
        }

        result
    })
}
