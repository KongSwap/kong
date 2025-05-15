use ic_cdk::query;

use super::market::*;
use crate::market::market::*;
use crate::nat::*;
use crate::stable_memory::*;
use crate::storage::MARKETS;
use crate::market::query_utils::MarketTransformer;
use crate::types::MarketId;

/// Gets a specific market by its ID with detailed betting statistics
#[query]
pub fn get_market(market_id: MarketId) -> Option<Market> {
    MARKETS.with(|markets| {
        // First, check if the market exists
        markets.borrow().get(&market_id).map(|market| {
            // Use the transformer to calculate all the market statistics
            let transformer = MarketTransformer::new();
            transformer.transform_market(market_id, &market)
        })
    })
}
