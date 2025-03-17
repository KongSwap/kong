use ic_cdk::query;
use strum::IntoEnumIterator;

use super::market_category::*;

/// Get all categories
#[query]
pub fn get_all_categories() -> Vec<String> {
    MarketCategory::iter().map(|c| c.to_string()).collect()
}
