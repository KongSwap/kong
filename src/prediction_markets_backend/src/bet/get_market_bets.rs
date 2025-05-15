use ic_cdk::query;

use super::bet::*;

use crate::stable_memory::*;
use crate::types::MarketId;
use crate::storage::get_bets_for_market;

/// Gets all bets for a specific market
#[query]
pub fn get_market_bets(market_id: MarketId) -> Vec<Bet> {
    get_bets_for_market(&market_id)
}
