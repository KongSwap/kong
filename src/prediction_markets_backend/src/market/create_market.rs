use ic_cdk::update;
use std::sync::atomic::{AtomicU64, Ordering};

use super::market::*;

use crate::admin::admin::*;
use crate::category::market_category::*;
use crate::nat::*;
use crate::resolution::resolution::*;
use crate::stable_memory::*;

// Global atomic counter for generating unique market IDs
static NEXT_ID: AtomicU64 = AtomicU64::new(0);

/// Creates a new prediction market
#[update]
fn create_market(
    question: String,
    category: MarketCategory,
    rules: String,
    outcomes: Vec<String>,
    resolution_method: ResolutionMethod,
    end_time_spec: MarketEndTime,
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

    let current_time = ic_cdk::api::time();

    // Calculate end time based on specification
    let end_time = match end_time_spec {
        MarketEndTime::Duration(duration_seconds) => {
            // Enforce minimum duration of 1 minute
            if duration_seconds.to_u64() < 60 {
                return Err("Duration must be at least 1 minute".to_string());
            }
            current_time + (duration_seconds.to_u64() * 1_000_000_000)
        }
        MarketEndTime::SpecificDate(end_date) => {
            let end_date_nanos = end_date.to_u64() * 1_000_000_000;
            if end_date_nanos <= current_time {
                return Err("End date must be in the future".to_string());
            }
            // Enforce minimum duration of 1 minute for specific dates too
            if end_date_nanos <= current_time + (60 * 1_000_000_000) {
                return Err("End date must be at least 1 minute in the future".to_string());
            }
            end_date_nanos
        }
    };

    let creator = ic_cdk::api::caller();
    ic_cdk::println!("Creator: {:?}", creator.to_string());

    // Verify the caller is an admin
    if !is_admin(creator) {
        return Err("Only admins can create markets".to_string());
    }

    MARKETS.with(|markets| {
        let market_id = StorableNat::from(NEXT_ID.fetch_add(1, Ordering::Relaxed));
        let outcome_count = outcomes.len();

        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(
            market_id.clone(),
            Market {
                id: market_id.clone(),
                creator,
                question,
                category,
                rules,
                outcomes,
                resolution_method,
                status: MarketStatus::Open,
                created_at: StorableNat::from(current_time),
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

        Ok(market_id)
    })
}
