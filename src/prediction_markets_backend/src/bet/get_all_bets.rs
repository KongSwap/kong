use ic_cdk::query;

use super::bet::*;

use crate::stable_memory::*;

/// Gets all bets with their associated market information
#[query]
pub fn get_all_bets(start_index: u64, limit: u64, reverse: bool) -> Vec<BetWithMarket> {
    // Pre-allocate a vector to store all bets
    let mut all_bets = Vec::new();

    BETS.with(|bets| {
        let bets = bets.borrow();
        MARKETS.with(|markets| {
            let markets = markets.borrow();

            // Collect all bets with their associated markets
            for (market_id, bet_store) in bets.iter() {
                if let Some(market) = markets.get(&market_id) {
                    let market = market.clone();
                    for bet in bet_store.0.iter() {
                        all_bets.push(BetWithMarket {
                            bet: bet.clone(),
                            market: market.clone(),
                        });
                    }
                }
            }
        });
    });

    // Sort bets by timestamp
    all_bets.sort_by(|a, b| {
        if reverse {
            b.bet.timestamp.cmp(&a.bet.timestamp)
        } else {
            a.bet.timestamp.cmp(&b.bet.timestamp)
        }
    });

    // Apply pagination
    all_bets.into_iter().skip(start_index as usize).take(limit as usize).collect()
}
