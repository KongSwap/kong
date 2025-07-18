use ic_cdk::query;

use super::market::*;

use crate::stable_memory::{STABLE_MARKETS, STABLE_BETS};
use crate::types::{MarketId, StorableNat};

use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub enum SortDirection {
    Ascending,
    Descending,
}

#[derive(CandidType, Deserialize)]
pub enum SortOption {
    CreatedAt(SortDirection),  // Sort by creation time
    TotalPool(SortDirection),  // Sort by total pool size
    EndTime(SortDirection),    // Sort by end time
}

#[derive(CandidType, Deserialize)]
pub struct GetAllMarketsArgs {
    pub start: MarketId,
    pub length: u64,
    pub status_filter: Option<MarketStatus>,
    pub sort_option: Option<SortOption>,  // Changed from sort_by_total_pool to be more flexible
}

#[derive(CandidType, Deserialize)]
pub struct GetAllMarketsResult {
    pub markets: Vec<Market>,
    pub total_count: StorableNat,
}

/// Gets all markets with detailed betting statistics, with pagination support
#[query]
pub fn get_all_markets(args: GetAllMarketsArgs) -> GetAllMarketsResult {
    STABLE_MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        
        // Get IDs and filter by status early to reduce dataset size
        let mut filtered_market_ids: Vec<MarketId> = Vec::new();
        
        // Apply status filter during initial collection
        for (id, market) in markets_ref.iter() {
            if let Some(status_filter) = &args.status_filter {
                match (status_filter, &market.status) {
                    (MarketStatus::Active, MarketStatus::Active) |
                    (MarketStatus::Closed(_), MarketStatus::Closed(_)) |
                    (MarketStatus::Disputed, MarketStatus::Disputed) |
                    (MarketStatus::Voided, MarketStatus::Voided) |
                    (MarketStatus::PendingActivation, MarketStatus::PendingActivation) |
                    (MarketStatus::ExpiredUnresolved, MarketStatus::ExpiredUnresolved) => filtered_market_ids.push(id),
                    _ => continue,
                }
            } else {
                filtered_market_ids.push(id);
            }
        }
        
        // Total count after filtering
        let total_count = StorableNat::from(filtered_market_ids.len() as u64);
        
        // Determine sort option - default to newest first (created_at descending)
        let sort_option = args.sort_option.unwrap_or(SortOption::CreatedAt(SortDirection::Descending));
        
        // We need the full market data for sorting
        let mut all_markets: Vec<(MarketId, Market)> = filtered_market_ids
            .iter()
            .map(|id| (id.clone(), markets_ref.get(id).unwrap().clone()))
            .collect();
        
        // Apply sorting based on the selected option
        match sort_option {
            SortOption::CreatedAt(direction) => {
                match direction {
                    SortDirection::Ascending => all_markets.sort_by(|(_, a), (_, b)| a.created_at.cmp(&b.created_at)),
                    SortDirection::Descending => all_markets.sort_by(|(_, a), (_, b)| b.created_at.cmp(&a.created_at)),
                }
            },
            SortOption::TotalPool(direction) => {
                match direction {
                    SortDirection::Ascending => all_markets.sort_by(|(_, a), (_, b)| a.total_pool.cmp(&b.total_pool)),
                    SortDirection::Descending => all_markets.sort_by(|(_, a), (_, b)| b.total_pool.cmp(&a.total_pool)),
                }
            }
            SortOption::EndTime(direction) => {
                match direction {
                    SortDirection::Ascending => all_markets.sort_by(|(_, a), (_, b)| a.end_time.cmp(&b.end_time)),
                    SortDirection::Descending => all_markets.sort_by(|(_, a), (_, b)| b.end_time.cmp(&a.end_time)),
                }
            }
        }
        
        // After applying regular sorting, prioritize featured markets
        // This keeps the original order within each group (featured and non-featured)
        all_markets.sort_by(|(_, a), (_, b)| {
            match (a.featured, b.featured) {
                (true, false) => std::cmp::Ordering::Less,     // Featured markets come first
                (false, true) => std::cmp::Ordering::Greater,  // Non-featured markets come after
                _ => std::cmp::Ordering::Equal,               // Maintain original sort order within each group
            }
        });
        
        // After featured sorting, always put resolved markets (Closed status) and voided markets last
        all_markets.sort_by(|(_, a), (_, b)| {
            let a_is_final = matches!(&a.status, MarketStatus::Closed(_) | MarketStatus::Voided);
            let b_is_final = matches!(&b.status, MarketStatus::Closed(_) | MarketStatus::Voided);
            
            match (a_is_final, b_is_final) {
                (true, true) => std::cmp::Ordering::Equal,   // Both are closed/voided, maintain order
                (true, false) => std::cmp::Ordering::Greater, // a is closed/voided, b is not - a goes last
                (false, true) => std::cmp::Ordering::Less,    // b is closed/voided, a is not - b goes last
                (false, false) => std::cmp::Ordering::Equal,  // Neither closed/voided, maintain order
            }
        });
        
        // Apply pagination after sorting
        let start_idx = args.start.to_u64() as usize;
        let length = args.length as usize;
        
        let paginated_markets = all_markets
            .into_iter()
            .skip(start_idx)
            .take(length)
            .map(|(market_id, market)| {
                calculate_market_stats(market_id, market.clone())
            })
            .collect();
        
        GetAllMarketsResult {
            markets: paginated_markets,
            total_count,
        }
    })
}

// Helper function to calculate market statistics
fn calculate_market_stats(market_id: MarketId, mut market: Market) -> Market {
    // Calculate outcome pools and bet counts
    let mut outcome_pools = vec![StorableNat::from(0u64); market.outcomes.len()];
    let mut bet_counts = vec![StorableNat::from(0u64); market.outcomes.len()];
    let mut total_bets = StorableNat::from(0u64);

    STABLE_BETS.with(|bets| {
        let bets_ref = bets.borrow();
        // Iterate through all bets and filter by market_id
        for (bet_key, bet) in bets_ref.iter() {
            if bet_key.market_id == market_id {
                let outcome_idx = bet.outcome_index.to_u64() as usize;
                if outcome_idx < outcome_pools.len() {
                    outcome_pools[outcome_idx] = outcome_pools[outcome_idx].clone() + bet.amount.clone();
                    bet_counts[outcome_idx] = bet_counts[outcome_idx].clone() + StorableNat::from_u64(1);
                    total_bets = total_bets.clone() + StorableNat::from_u64(1);
                }
            }
        }
    });

    // Calculate percentages
    market.outcome_percentages = outcome_pools
        .iter()
        .map(|amount| {
            if !market.total_pool.is_zero() {
                amount.to_f64() / market.total_pool.to_f64() * 100.0
            } else {
                0.0
            }
        })
        .collect();
    market.bet_counts = bet_counts.clone();

    market.bet_count_percentages = bet_counts
        .iter()
        .map(|count| {
            if !total_bets.is_zero() {
                count.to_f64() / total_bets.to_f64() * 100.0
            } else {
                0.0
            }
        })
        .collect();

    market
}
