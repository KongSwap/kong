use ic_cdk::update;
use std::sync::atomic::{AtomicU64, Ordering};

use super::market::*;

use crate::category::market_category::*;
use crate::controllers::admin::*;
use crate::nat::*;
use crate::resolution::resolution::*;
use crate::stable_memory::*;

pub static MARKET_ID: AtomicU64 = AtomicU64::new(0);

pub fn max_market_id() -> u64 {
    MARKETS.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.to_u64()))
}

/// Creates a new prediction market
#[update]
fn create_market(
    question: String,
    category: MarketCategory,
    rules: String,
    outcomes: Vec<String>,
    resolution_method: ResolutionMethod,
    end_time_secs: MarketEndTime,
    image_url: Option<String>,
) -> Result<MarketId, String> {
    // Validate inputs
    if question.is_empty() {
        return Err("Question cannot be empty".to_string());
    }
    if outcomes.len() < 2 {
        return Err("Market must have at least 2 outcomes".to_string());
    }
    if outcomes.len() > 10 {
        return Err("Market cannot have more than 10 outcomes".to_string());
    }

    let now = ic_cdk::api::time();
    let user = ic_cdk::api::caller();
    if !is_admin(user) {
        return Err("Only admins can create markets".to_string());
    }

    let end_time = match end_time_secs {
        MarketEndTime::Duration(duration_seconds) => now + (duration_seconds.to_u64() * 1_000_000_000),
        MarketEndTime::SpecificDate(end_date) => end_date.to_u64() * 1_000_000_000,
    };
    if end_time <= now + (60 * 1_000_000_000) {
        return Err("End time must be at least 1 minute in the future".to_string());
    }

    let market_id = MARKETS.with(|m| {
        let mut map = m.borrow_mut();
        let market_id = StorableNat::from(MARKET_ID.fetch_add(1, Ordering::SeqCst) + 1);
        let outcome_count = outcomes.len();
        map.insert(
            market_id.clone(),
            Market {
                id: market_id.clone(),
                creator: user,
                question,
                category,
                rules,
                outcomes,
                resolution_method,
                image_url,
                status: MarketStatus::Open,
                created_at: StorableNat::from(now),
                end_time: StorableNat::from(end_time),
                total_pool: StorableNat::from(0u64),
                resolution_data: None,
                outcome_pools: vec![StorableNat::from(0u64); outcome_count],
                outcome_percentages: vec![0.0; outcome_count],
                bet_counts: vec![StorableNat::from(0u64); outcome_count],
                bet_count_percentages: vec![0.0; outcome_count],
                resolved_by: None,
            },
        );
        market_id
    });

    Ok(market_id)
}
