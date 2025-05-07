//! # Market Sorting Utilities
//! 
//! This module provides standardized sorting logic for markets
//! that can be reused across various market query functions.

use crate::market::market::Market;
use crate::types::MarketId;

/// Market sort fields
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarketSortField {
    /// Sort by market creation time
    CreationTime,
    /// Sort by market end time
    EndTime,
    /// Sort by total pool size
    TotalPool,
    /// Sort by total number of bets
    TotalBets,
    /// Sort by market ID
    MarketId,
}

/// Sort direction
#[derive(Debug, Clone, Copy, PartialEq, Eq, candid::CandidType, serde::Deserialize)]
pub enum SortDirection {
    /// Ascending sort (low to high)
    Ascending,
    /// Descending sort (high to low)
    Descending,
}

/// A reusable market sorter for ordering markets in query results
#[derive(Debug, Clone)]
pub struct MarketSorter {
    /// Field to sort by
    field: MarketSortField,
    /// Sort direction
    direction: SortDirection,
}

impl MarketSorter {
    /// Create a new market sorter
    pub fn new(field: MarketSortField, direction: SortDirection) -> Self {
        Self { field, direction }
    }
    
    /// Sort a vector of markets in place
    pub fn sort(&self, markets: &mut Vec<(MarketId, Market)>) {
        match self.field {
            MarketSortField::CreationTime => {
                markets.sort_by(|(_, a), (_, b)| {
                    let comparison = a.created_at.cmp(&b.created_at);
                    self.apply_direction(comparison)
                });
            }
            MarketSortField::EndTime => {
                markets.sort_by(|(_, a), (_, b)| {
                    let comparison = a.end_time.cmp(&b.end_time);
                    self.apply_direction(comparison)
                });
            }
            MarketSortField::TotalPool => {
                markets.sort_by(|(_, a), (_, b)| {
                    let comparison = a.total_pool.cmp(&b.total_pool);
                    self.apply_direction(comparison)
                });
            }
            MarketSortField::TotalBets => {
                markets.sort_by(|(_, a), (_, b)| {
                    // To get total bets we need to sum up bet_counts array
                    let sum_a: u64 = a.bet_counts.iter().map(|c| c.to_u64()).sum();
                    let sum_b: u64 = b.bet_counts.iter().map(|c| c.to_u64()).sum();
                    let comparison = sum_a.cmp(&sum_b);
                    self.apply_direction(comparison)
                });
            }
            MarketSortField::MarketId => {
                markets.sort_by(|(id_a, _), (id_b, _)| {
                    let comparison = id_a.cmp(id_b);
                    self.apply_direction(comparison)
                });
            }
        }
    }
    
    /// Apply the sort direction to a comparison
    fn apply_direction(&self, comparison: std::cmp::Ordering) -> std::cmp::Ordering {
        match self.direction {
            SortDirection::Ascending => comparison,
            SortDirection::Descending => comparison.reverse(),
        }
    }
}
