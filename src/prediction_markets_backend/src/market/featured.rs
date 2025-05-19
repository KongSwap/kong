use ic_cdk::{update, query};
use candid::{CandidType, Deserialize};

use crate::controllers::admin::is_admin;
use crate::storage::MARKETS;
use crate::types::MarketId;
use crate::nat::StorableNat;
use crate::market::market::Market;
use crate::market::query_utils::MarketTransformer;

/// Set or unset the featured status of a market (admin only)
#[update]
pub fn set_market_featured(market_id: MarketId, featured: bool) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    // Verify caller is an admin
    if !is_admin(caller) {
        return Err("Unauthorized: caller is not an admin".to_string());
    }
    
    // Update the featured status of the market
    MARKETS.with(|markets| {
        let mut markets_borrow = markets.borrow_mut();
        
        // Check if the market exists first
        if let Some(market) = markets_borrow.get(&market_id) {
            // Create an updated copy of the market with the new featured status
            let mut updated_market = market.clone();
            updated_market.featured = featured;
            
            // Update the market in the map
            markets_borrow.insert(market_id.clone(), updated_market);
            
            ic_cdk::println!("Market {} featured status set to {} by admin {}", 
                          market_id.to_u64(), featured, caller.to_string());
            
            Ok(())
        } else {
            Err(format!("Market with ID {} not found", market_id.to_u64()))
        }
    })
}

/// Arguments for retrieving featured markets
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GetFeaturedMarketsArgs {
    pub start: StorableNat,
    pub length: StorableNat,
}

/// Result of retrieving featured markets
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GetFeaturedMarketsResult {
    pub markets: Vec<Market>,
    pub total: StorableNat,
}

/// Get featured markets with pagination
#[query]
pub fn get_featured_markets(args: GetFeaturedMarketsArgs) -> GetFeaturedMarketsResult {
    let start = args.start.to_u64() as usize;
    let length = args.length.to_u64() as usize;
    
    let transformer = MarketTransformer::new();
    
    let featured_markets: Vec<(MarketId, Market)> = MARKETS.with(|markets| {
        markets.borrow()
            .iter()
            .filter(|(_, market)| market.featured)
            .map(|(id, market)| (id.clone(), market.clone()))
            .collect()
    });
    
    let total = featured_markets.len();
    
    // Transform all markets before pagination (to add computed fields)
    let transformed_markets: Vec<Market> = featured_markets
        .into_iter()
        .map(|(id, market)| transformer.transform_market(id, &market))
        .collect();
    
    // Apply pagination
    let paginated_markets = transformed_markets
        .into_iter()
        .skip(start)
        .take(length)
        .collect();
    
    GetFeaturedMarketsResult {
        markets: paginated_markets,
        total: StorableNat::from(total as u64),
    }
}
