
use candid::CandidType;
use serde::Deserialize;

use super::market::Market;
use super::query_utils::{MarketFilter, MarketSorter, MarketTransformer, SortDirection, MarketSortField};

use crate::nat::*;
use crate::storage::MARKETS;
use crate::types::TokenIdentifier;

#[derive(CandidType, Deserialize)]
pub struct SearchMarketsArgs {
    /// Text to search for in market questions
    pub query: String,
    /// Optional token ID to filter markets by token
    pub token_id: Option<TokenIdentifier>,
    /// Pagination start index
    pub start: StorableNat,
    /// Number of results to return per page
    pub length: StorableNat,
    /// Optional field to sort by (default: relevance)
    pub sort_field: Option<SortField>,
    /// Sort direction (default: descending)
    pub sort_direction: Option<SortDirection>,
    /// Whether to include resolved markets in search results
    pub include_resolved: bool,
}

#[derive(CandidType, Deserialize, Clone, Copy)]
pub enum SortField {
    /// Sort by creation time
    CreationTime,
    /// Sort by end time
    EndTime,
    /// Sort by total pool size
    TotalPool,
    /// Sort by total number of bets
    TotalBets,
}

#[derive(CandidType, Deserialize)]
pub struct SearchMarketsResult {
    pub markets: Vec<Market>,
    pub total: StorableNat,
}

/// Search for markets by text in the question field with optional filtering and sorting
pub fn search_markets(args: SearchMarketsArgs) -> SearchMarketsResult {
    // Create a filter to match markets by text search
    let mut filter = MarketFilter::new()
        .with_text_search(args.query);
    
    // Apply token filter if provided
    if let Some(token_id) = args.token_id {
        filter = filter.with_token_id(token_id);
    }
    
    // Filter out resolved markets if requested
    if !args.include_resolved {
        filter = filter.with_statuses(vec![
            crate::market::market::MarketStatus::Active,
            crate::market::market::MarketStatus::PendingActivation,
            crate::market::market::MarketStatus::Disputed,
        ]);
    }
    
    // Create a market transformer
    let transformer = MarketTransformer::new();
    
    // Configure sorting if requested
    let sorter = if let Some(sort_field) = args.sort_field {
        // Map the public enum to our internal sort field
        let field = match sort_field {
            SortField::CreationTime => MarketSortField::CreationTime,
            SortField::EndTime => MarketSortField::EndTime,
            SortField::TotalPool => MarketSortField::TotalPool,
            SortField::TotalBets => MarketSortField::TotalBets,
        };
        
        // Get the sort direction or use the default (Descending)
        let direction = args.sort_direction.unwrap_or(SortDirection::Descending);
        
        Some(MarketSorter::with_options(field, direction))
    } else {
        // Default to sorting by creation time (most recent first)
        Some(MarketSorter::with_options(
            MarketSortField::CreationTime,
            SortDirection::Descending,
        ))
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
    
    SearchMarketsResult {
        markets: transformed_markets,
        total: StorableNat::from(total as u64),
    }
}
