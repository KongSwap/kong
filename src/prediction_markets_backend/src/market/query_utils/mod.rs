//! # Market Query Utilities
//! 
//! This module provides reusable components for filtering, sorting, and transforming
//! markets in query operations. It eliminates code duplication across various market
//! query functions by centralizing common patterns.
//!
//! Key components:
//! - `filter`: Provides flexible market filtering by various criteria
//! - `sort`: Implements standardized sorting operations for markets
//! - `transform`: Handles transformation of internal market data to API responses

pub mod filter;
pub mod sort;
pub mod transform;

pub use filter::MarketFilter;
pub use sort::{MarketSorter, SortDirection, MarketSortField};
pub use transform::MarketTransformer;

use crate::market::market::Market;
use crate::types::MarketId;

/// Composite query function that combines filtering, sorting, and transformation
pub fn query_markets<F, T>(
    filter: &MarketFilter,
    sorter: Option<&MarketSorter>,
    _transformer: &MarketTransformer,
    market_provider: F,
) -> Vec<T>
where
    F: FnOnce() -> Vec<(MarketId, Market)>,
    T: From<(MarketId, Market)>,
{
    // Get markets from provider function
    let mut markets = filter.apply(market_provider());
    
    // Apply sorting if provided
    if let Some(sorter) = sorter {
        sorter.sort(&mut markets);
    }
    
    // Transform and return
    markets.into_iter()
        .map(|m| T::from(m))
        .collect()
}
