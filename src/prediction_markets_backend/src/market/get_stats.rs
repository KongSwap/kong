use ic_cdk::query;
use candid::CandidType;
use serde::Deserialize;

use crate::types::StorableNat;
use crate::storage::MARKETS;
use crate::bet::bet::BETS;
use super::market::MarketStatus; // Import MarketStatus

#[derive(CandidType, Deserialize)]
pub struct StatsResult {
    pub total_markets: StorableNat,
    pub total_active_markets: StorableNat,
    pub total_bets: StorableNat,
}

/// Returns global statistics about the prediction markets.
#[query]
pub fn get_stats() -> StatsResult {
    let now = ic_cdk::api::time();
    let mut total_markets = 0u64;
    let mut total_active_markets = 0u64;
    let mut total_bets = StorableNat::from(0u64);

    MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        total_markets = markets_ref.len() as u64;

        for (_, market) in markets_ref.iter() {
            // A market is active if it's Active and its end_time hasn't passed yet.
            if market.status == MarketStatus::Active && now < market.end_time {
                total_active_markets += 1;
            }
        }
    });

    BETS.with(|bets| {
        let bets_ref = bets.borrow();
        // Count the total number of bets by iterating through all bet entries
        let bet_count = bets_ref.iter().count() as u64;
        total_bets = total_bets.clone() + StorableNat::from(bet_count);
    });

    StatsResult {
        total_markets: StorableNat::from(total_markets),
        total_active_markets: StorableNat::from(total_active_markets),
        total_bets,
    }
} 