use ic_cdk::query;

use super::market::*;

use crate::nat::*;
use crate::stable_memory::*;

/// Gets a specific market by its ID with detailed betting statistics
#[query]
pub fn get_market(market_id: MarketId) -> Option<Market> {
    MARKETS.with(|markets| {
        markets.borrow().get(&market_id).map(|market| {
            let mut market = market.clone();

            // Calculate outcome pools and bet counts
            let mut outcome_pools = vec![0u64; market.outcomes.len()];
            let mut bet_counts = vec![StorableNat::from(0u64); market.outcomes.len()];
            let mut total_bets = StorableNat::from(0u64);

            BETS.with(|bets| {
                if let Some(bet_store) = bets.borrow().get(&market_id) {
                    for bet in bet_store.0.iter() {
                        let outcome_idx = bet.outcome_index.to_u64() as usize;
                        outcome_pools[outcome_idx] = (StorableNat::from(outcome_pools[outcome_idx]) + bet.amount.clone()).to_u64();
                        bet_counts[outcome_idx] = bet_counts[outcome_idx].clone() + StorableNat::from_u64(1);
                        total_bets = total_bets.clone() + StorableNat::from_u64(1);
                    }
                }
            });

            // Calculate percentages
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

            // Clear rules as they're not relevant in this context
            market.rules = String::new();

            market
        })
    })
}
