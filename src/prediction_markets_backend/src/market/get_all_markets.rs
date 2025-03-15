use ic_cdk::query;

use super::market::*;

use crate::nat::*;
use crate::stable_memory::*;

use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct GetAllMarketsArgs {
    pub start: StorableNat,
    pub length: StorableNat,
}

#[derive(CandidType, Deserialize)]
pub struct GetAllMarketsResult {
    pub markets: Vec<Market>,
    pub total_count: StorableNat,
}

/// Gets all markets with detailed betting statistics, with pagination support
#[query]
pub fn get_all_markets(args: GetAllMarketsArgs) -> GetAllMarketsResult {
    MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        let total_count = StorableNat::from(markets_ref.len() as u64);
        
        // Convert to Vec for pagination
        let all_markets: Vec<(MarketId, Market)> = markets_ref.iter().collect();
        
        // Apply pagination
        let start_idx = args.start.to_u64() as usize;
        let length = args.length.to_u64() as usize;
        
        let paginated_markets = all_markets
            .into_iter()
            .skip(start_idx)
            .take(length)
            .map(|(market_id, market)| {
                let mut market = market.clone();

                // Calculate outcome pools and bet counts
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
                        }
                    }
                });

                // Calculate percentages
                let outcome_pools_clone = outcome_pools.clone();
                market.outcome_percentages = outcome_pools_clone
                    .iter()
                    .map(|amount| {
                        if !market.total_pool.is_zero() {
                            amount.to_f64() / market.total_pool.to_f64() * 100.0
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

                // Keep market rules in the response

                market
            })
            .collect();
            
        GetAllMarketsResult {
            markets: paginated_markets,
            total_count,
        }
    })
}
