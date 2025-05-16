
use candid::{CandidType, Principal};
use serde::Deserialize;

use super::market::Market;
use super::query_utils::{MarketFilter, MarketSorter, MarketTransformer, SortDirection, MarketSortField};

use crate::nat::StorableNat;
use crate::storage::MARKETS;

#[derive(CandidType, Deserialize)]
pub struct GetMarketsByCreatorArgs {
    pub creator: Principal,
    pub start: StorableNat,
    pub length: StorableNat,
    pub sort_by_creation_time: bool, // If true, sort by creation time descending
}

#[derive(CandidType, Deserialize)]
pub struct GetMarketsByCreatorResult {
    pub markets: Vec<Market>,
    pub total: StorableNat,
}

/// Get markets created by a specific user with pagination and sorting
pub fn get_markets_by_creator(args: GetMarketsByCreatorArgs) -> GetMarketsByCreatorResult {
    // Create the filter to select markets by creator
    let filter = MarketFilter::new()
        .with_creator(args.creator);
    
    // Create a transformer to calculate market statistics
    let transformer = MarketTransformer::new();
    
    // Determine if we should sort (default: creation time descending)
    let sorter = if args.sort_by_creation_time {
        Some(MarketSorter::with_options(
            MarketSortField::CreationTime,
            SortDirection::Descending,
        ))
    } else {
        None
    };
    
    // Get all markets
    let all_markets = MARKETS.with(|markets| {
        markets.borrow().iter().collect::<Vec<_>>()
    });
    
    // Apply the filter
    let filtered_markets = filter.apply(all_markets);
    
    // Store total count before pagination
    let total = filtered_markets.len();
    
    // Apply sorting if requested
    let mut sorted_markets = filtered_markets;
    if let Some(sorter) = &sorter {
        sorter.sort(&mut sorted_markets);
    }
    
    // Apply pagination
    let start = args.start.to_u64() as usize;
    let length = args.length.to_u64() as usize;
    let paginated_markets = if length > 0 {
        sorted_markets.into_iter()
            .skip(start)
            .take(length)
            .collect::<Vec<_>>()
    } else {
        sorted_markets
    };
    
    // Transform markets into the expected format
    let transformed_markets = paginated_markets.into_iter()
        .map(|(market_id, market)| transformer.transform_market(market_id, &market))
        .collect();
    
    GetMarketsByCreatorResult {
        markets: transformed_markets,
        total: StorableNat::from(total as u64),
    }
}
