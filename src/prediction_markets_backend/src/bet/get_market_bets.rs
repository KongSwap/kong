use ic_cdk::query;

use super::bet::*;

use crate::stable_memory::*;
use crate::types::MarketId;

/// Gets all bets for a specific market
#[query]
pub fn get_market_bets(market_id: MarketId) -> Vec<Bet> {
    BETS.with(|bets| bets.borrow().get(&market_id).map(|bet_store| bet_store.0).unwrap_or_default())
}
