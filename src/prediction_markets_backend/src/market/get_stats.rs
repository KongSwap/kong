use ic_cdk::query;
use candid::CandidType;
use serde::Deserialize;
use num_traits::ToPrimitive;

use crate::nat::*;
use crate::stable_memory::*;
use super::market::{MarketStatus}; // Import MarketStatus

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
            // A market is active if it's Open and its end_time hasn't passed yet.
            if market.status == MarketStatus::Open && now < market.end_time {
                total_active_markets += 1;
            }
        }
    });

    BETS.with(|bets| {
        let bets_ref = bets.borrow();
        for (_, bet_store) in bets_ref.iter() {
            // Sum the number of bets in each market's BetStore.
            total_bets = total_bets.clone() + StorableNat::from(bet_store.0.len() as u64);
        }
    });

    StatsResult {
        total_markets: StorableNat::from(total_markets),
        total_active_markets: StorableNat::from(total_active_markets),
        total_bets,
    }
} 