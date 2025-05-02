use ic_cdk::update;
use std::sync::atomic::{AtomicU64, Ordering};

use super::market::*;

use crate::category::market_category::*;
use crate::controllers::admin::*;
use crate::resolution::resolution::*;
use crate::stable_memory::*;
use crate::types::{MarketId, Timestamp, TokenAmount, NANOS_PER_SECOND};

pub static MARKET_ID: AtomicU64 = AtomicU64::new(0);

/// Returns the maximum market ID as u64 (for internal use with AtomicU64)
pub fn max_market_id() -> u64 {
    MARKETS.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.to_u64()))
}

/// Returns the maximum market ID as MarketId (for external interfaces)
pub fn max_market_id_typed() -> MarketId {
    MarketId::from(max_market_id())
}

/// Creates a new prediction market
#[update]
pub fn create_market(
    question: String,
    category: MarketCategory,
    rules: String,
    outcomes: Vec<String>,
    resolution_method: ResolutionMethod,
    end_time_secs: MarketEndTime,
    image_url: Option<String>,
    uses_time_weighting: Option<bool>,
    time_weight_alpha: Option<f64>,
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

    // Get current time and caller principal
    let now = ic_cdk::api::time();
    let user = ic_cdk::api::caller();
    let is_admin_user = is_admin(user);
    
    // Both admins and regular users can create markets now

    // Calculate end time based on duration or specific date
    let end_time = match end_time_secs {
        MarketEndTime::Duration(duration_seconds) => now + (duration_seconds.to_u64() * NANOS_PER_SECOND),
        MarketEndTime::SpecificDate(end_date) => end_date.to_u64() * NANOS_PER_SECOND,
    };
    // Ensure end time is at least 1 minute in the future
    if end_time <= now + (60 * NANOS_PER_SECOND) {
        return Err("End time must be at least 1 minute in the future".to_string());
    }

    // Create new market with unique ID
    let market_id = MARKETS.with(|m| {
        let mut map = m.borrow_mut();
        let market_id = MarketId::from(MARKET_ID.fetch_add(1, Ordering::SeqCst) + 1);
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
                status: if is_admin_user { MarketStatus::Active } else { MarketStatus::Pending },
                created_at: Timestamp::from(now),
                end_time: Timestamp::from(end_time),
                total_pool: TokenAmount::from(0u64),
                resolution_data: None,
                outcome_pools: vec![TokenAmount::from(0u64); outcome_count],
                outcome_percentages: vec![0.0; outcome_count],
                bet_counts: vec![TokenAmount::from(0u64); outcome_count],
                bet_count_percentages: vec![0.0; outcome_count],
                resolved_by: None,
                uses_time_weighting: uses_time_weighting.unwrap_or(true), // all new prediction markets use time-weighting as default type
                time_weight_alpha: time_weight_alpha,
            },
        );
        market_id
    });

    Ok(market_id)
}
