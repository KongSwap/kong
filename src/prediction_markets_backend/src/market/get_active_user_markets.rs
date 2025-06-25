use ic_cdk::query;
use candid::{CandidType, Principal};
use serde::Deserialize;

use super::market::*;
use super::get_all_markets::{SortOption, SortDirection};

use crate::stable_memory::{STABLE_MARKETS, STABLE_BETS};
use crate::types::{MarketId, StorableNat};

#[derive(CandidType, Deserialize)]
pub struct GetActiveUserMarketsArgs {
    pub user: Principal,
    pub start: MarketId,
    pub length: u64,
    pub sort_option: Option<SortOption>,
}

#[derive(CandidType, Deserialize)]
pub struct GetActiveUserMarketsResult {
    pub markets: Vec<Market>,
    pub total_count: StorableNat,
}

/// Gets active markets where the user is either the creator or has placed bets
#[query]
pub fn get_active_user_markets(args: GetActiveUserMarketsArgs) -> GetActiveUserMarketsResult {
    STABLE_MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        
        // Get markets where the user is the creator or has placed bets
        let mut user_market_ids: Vec<MarketId> = Vec::new();
        
        // Step 1: Find markets created by the user that are active
        for (id, market) in markets_ref.iter() {
            if market.creator == args.user && matches!(market.status, MarketStatus::Active) {
                user_market_ids.push(id);
            }
        }
        
        // Step 2: Find markets where the user has placed bets and the market is active
        STABLE_BETS.with(|bets| {
            let bets_ref = bets.borrow();
            
            for (_, bet) in bets_ref.iter() {
                if bet.user == args.user {
                    // Check if this market is active and not already in our list
                    if let Some(market) = markets_ref.get(&bet.market_id) {
                        if matches!(market.status, MarketStatus::Active) && !user_market_ids.contains(&bet.market_id) {
                            user_market_ids.push(bet.market_id);
                        }
                    }
                }
            }
        });
        
        // Total count after filtering
        let total_count = StorableNat::from(user_market_ids.len() as u64);
        
        // Determine sort option - default to newest first (created_at descending)
        let sort_option = args.sort_option.unwrap_or(SortOption::CreatedAt(SortDirection::Descending));
        
        // Get the full market data for sorting
        let mut user_markets: Vec<(MarketId, Market)> = user_market_ids
            .iter()
            .filter_map(|id| markets_ref.get(id).map(|market| (id.clone(), market.clone())))
            .collect();
        
        // Apply sorting based on the selected option
        match sort_option {
            SortOption::CreatedAt(direction) => {
                match direction {
                    SortDirection::Ascending => user_markets.sort_by(|(_, a), (_, b)| a.created_at.cmp(&b.created_at)),
                    SortDirection::Descending => user_markets.sort_by(|(_, a), (_, b)| b.created_at.cmp(&a.created_at)),
                }
            },
            SortOption::TotalPool(direction) => {
                match direction {
                    SortDirection::Ascending => user_markets.sort_by(|(_, a), (_, b)| a.total_pool.cmp(&b.total_pool)),
                    SortDirection::Descending => user_markets.sort_by(|(_, a), (_, b)| b.total_pool.cmp(&a.total_pool)),
                }
            }
            SortOption::EndTime(direction) => {
                match direction {
                    SortDirection::Ascending => user_markets.sort_by(|(_, a), (_, b)| a.end_time.cmp(&b.end_time)),
                    SortDirection::Descending => user_markets.sort_by(|(_, a), (_, b)| b.end_time.cmp(&a.end_time)),
                }
            }
        }
        
        // Prioritize featured markets (same logic as get_all_markets)
        user_markets.sort_by(|(_, a), (_, b)| {
            match (a.featured, b.featured) {
                (true, false) => std::cmp::Ordering::Less,     // Featured markets come first
                (false, true) => std::cmp::Ordering::Greater,  // Non-featured markets come after
                _ => std::cmp::Ordering::Equal,               // Maintain original sort order within each group
            }
        });
        
        // Apply pagination after sorting
        let start_idx = args.start.to_u64() as usize;
        let length = args.length as usize;
        
        let paginated_markets = if length > 0 {
            user_markets.into_iter()
                .skip(start_idx)
                .take(length)
                .map(|(_, market)| market)
                .collect()
        } else {
            user_markets.into_iter().map(|(_, market)| market).collect()
        };
        
        GetActiveUserMarketsResult {
            markets: paginated_markets,
            total_count,
        }
    })
} 