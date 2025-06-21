//! # Market Creation Module
//!
//! This module implements the functionality for creating new prediction markets in the
//! Kong Swap platform. It handles validation of market parameters, initialization of
//! market structures, and application of appropriate permissions based on creator status.
//!
//! ## Key Features
//!
//! - **Multi-token Support**: Markets can be created with different token types (KONG, ICP, etc.)
//! - **Time-weighted Distribution**: Optional exponential weighting model that rewards earlier bets
//! - **Flexible End Times**: Markets can end after a duration or at a specific date
//! - **Governance Controls**: Admin-created markets are immediately active, while user-created
//!   markets require activation (and later dual approval for resolution)
//!
//! The module maintains a global atomic counter to ensure each market receives a unique ID,
//! even across canister upgrades.

use ic_cdk::update;
use std::sync::atomic::{AtomicU64, Ordering};

use super::market::*;
use crate::token::registry::KONG_LEDGER_ID_LOCAL;
use crate::token::registry::{is_supported_token, TokenIdentifier};

use crate::category::market_category::*;
use crate::controllers::admin::*;
use crate::resolution::resolution::*;
use crate::storage::MARKETS;
use crate::types::{MarketId, Timestamp, TokenAmount, NANOS_PER_SECOND};

/// Global atomic counter for generating unique market IDs
///
/// This counter is maintained across canister upgrades through the stable memory
/// restoration process. When the canister upgrades, the counter is reset to the
/// highest market ID found in stable storage plus one.
pub static MARKET_ID: AtomicU64 = AtomicU64::new(0);

/// Creates a new prediction market with specified parameters
///
/// This function allows users or admins to create new prediction markets. The markets
/// can use various token types and distribution models (standard or time-weighted).
/// Admin-created markets are immediately active, while user-created markets start in
/// a pending state and require activation before accepting bets.
///
/// ## Market Creation Flows
///
/// The system supports two distinct creation flows based on the creator's role:
///
/// 1. **Admin-Created Markets**:
///    - Start in `Active` status immediately
///    - Can be directly resolved by any admin without dual approval
///    - Useful for official or curated prediction markets
///
/// 2. **User-Created Markets**:
///    - Start in `Pending` status
///    - Require activation with an initial bet by the creator
///    - Need dual approval for resolution (creator and admin must agree)
///    - Support community-driven market creation
///
/// ## Time-Weighted Distribution
///
/// The platform's innovative time-weighted distribution model rewards earlier bets with
/// higher payouts using an exponential decay function. With the default parameter α = 0.1,
/// bets placed at market start receive 10x the weight of those placed at market end.
///
/// This creates several advantages:
/// - Incentivizes early price discovery
/// - Rewards users who take positions when uncertainty is highest
/// - Maintains a guaranteed return floor (all winners get at least their original bet back)
///
/// ## Multi-Token Support
///
/// Markets can be denominated in various token types:
/// - KONG tokens (platform native token)
/// - ICP (Internet Computer Protocol tokens)
/// - Other supported ICRC-1/ICRC-2 compliant tokens
///
/// Each token has specific configuration for:
/// - Minimum activation amount
/// - Transfer fees
/// - Platform fee percentages
///
/// # Parameters
/// * `question` - The main question or title of the prediction market
/// * `category` - Market category for organization and filtering
/// * `rules` - Detailed rules and conditions for market resolution
/// * `outcomes` - Possible outcomes users can bet on (2-10 allowed)
/// * `resolution_method` - Method for determining the winning outcome
/// * `end_time_secs` - When the market closes for betting (duration or specific date)
/// * `image_url` - Optional URL to an image representing the market
/// * `uses_time_weighting` - Whether to use time-weighted distribution (default: true)
/// * `time_weight_alpha` - Decay parameter for time-weighting (default: 0.1)
/// * `token_id` - Token type to use for this market (default: KONG)
///
/// # Returns
/// * `Result<MarketId, String>` - On success, returns the ID of the new market.
///   On failure, returns an error message explaining why creation failed.
///
/// # Creation Process
/// 1. **Validation**:
///    - Question length and content validation
///    - Outcome count validation (2-10 outcomes)
///    - Token support verification
///    - End time validation
///
/// 2. **Initialization**:
///    - Generate unique market ID
///    - Set initial state (pools, percentages, etc.)
///    - Configure time-weighted parameters if enabled
///
/// 3. **Status Assignment**:
///    - Admin creators: Market starts as `Active`
///    - User creators: Market starts as `Pending` (requires activation bet)
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
    token_id: Option<TokenIdentifier>,
) -> Result<MarketId, String> {
    // Validate market parameters
    // These checks ensure the market is properly configured and can be displayed
    // and resolved correctly in the frontend application

    // Question validation - must have a non-empty question
    if question.is_empty() {
        return Err("Question cannot be empty".to_string());
    }

    // Outcome validation - must have between 2-10 possible outcomes
    if outcomes.len() < 2 {
        return Err("Market must have at least 2 outcomes".to_string());
    }
    if outcomes.len() > 10 {
        return Err("Market cannot have more than 10 outcomes".to_string());
    }

    // Token validation - ensure the market uses a supported token type
    // If no token is specified, default to KONG tokens
    let token_id = token_id.unwrap_or_else(|| KONG_LEDGER_ID_LOCAL.to_string());
    if !is_supported_token(&token_id) {
        return Err(format!(
            "Unsupported token: {}. Please use one of the supported token types.",
            token_id
        ));
    }

    // Get current time and caller principal
    let now = ic_cdk::api::time();
    let user = ic_cdk::api::caller();
    let is_admin_user = is_admin(user);

    // Authorization check
    // Both admins and regular users can create markets, but with different initial statuses:
    // - Admin-created markets start as Active (immediately available for betting)
    // - User-created markets start as Pending (require admin approval before accepting bets)
    // - Only admin-created markets can bypass the dual approval resolution process

    // Calculate market end time
    // Markets can be specified to end after a duration (e.g. 120 seconds) or at a
    // specific date/time. This flexibility allows for both quick test markets and
    // longer real-world prediction events.
    let end_time = match end_time_secs {
        MarketEndTime::Duration(duration_seconds) => now + (duration_seconds.to_u64() * NANOS_PER_SECOND),
        MarketEndTime::SpecificDate(end_date) => end_date.to_u64() * NANOS_PER_SECOND,
    };

    // Market duration validation - ensure sufficient time for betting
    // The minimum of 1 minute allows for at least some bets to be placed
    // In production, real markets typically run for hours or days
    // For testing, markets can be set to run for 120 seconds (2 minutes)
    if end_time <= now + (60 * NANOS_PER_SECOND) {
        return Err("End time must be at least 1 minute in the future".to_string());
    }

    // Use time weighting by default
    let uses_time_weighting = uses_time_weighting.unwrap_or(true);

    if !uses_time_weighting {
        return Err("Only time-weighted markets are supported".to_string());
    }

    if let Some(time_weight_alpha) = time_weight_alpha {
        if !(time_weight_alpha > 0.0 && time_weight_alpha <= 1.0) {
            return Err("time_weight_alpha should be in interval: (0, 1]".to_string());
        }
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
                status: if is_admin_user {
                    MarketStatus::Active
                } else {
                    MarketStatus::PendingActivation
                },
                created_at: Timestamp::from(now),
                end_time: Timestamp::from(end_time),
                total_pool: TokenAmount::from(0u64),
                resolution_data: None,
                outcome_pools: vec![TokenAmount::from(0u64); outcome_count],
                outcome_percentages: vec![0.0; outcome_count],
                bet_counts: vec![TokenAmount::from(0u64); outcome_count],
                bet_count_percentages: vec![0.0; outcome_count],
                resolved_by: None,
                // Time-weighted distribution configuration
                // Time-Weighted Distribution Configuration
                //
                // The time-weighted distribution system is a key innovation of Kong Swap prediction markets,
                // providing an exponential weighting model that rewards earlier bets with higher payouts.
                //
                // The time_weight_alpha parameter controls the steepness of the exponential decay curve:
                // - α = 0.1 (default): Very steep curve; earliest bets get ~10x weight of latest bets
                // - α = 0.3: Moderate curve; earliest bets get ~3.3x weight of latest bets
                // - α = 0.5: Gentle curve; earliest bets get 2x weight of latest bets
                // - α = 1.0: Flat line; equivalent to standard (non-weighted) distribution
                //
                // Markets default to time-weighted distribution (unless explicitly disabled)
                // as it provides better incentives for early price discovery and market efficiency.
                uses_time_weighting: uses_time_weighting,
                time_weight_alpha: time_weight_alpha, // Defaults to 0.1 if not specified

                // Multi-Token Market Support
                //
                // This field specifies which token type the market uses for bets and payouts.
                // All bets in this market must use this specific token type, and all payouts
                // will be distributed in the same token. The system supports KONG, ICP,
                // and other ICRC-compliant tokens registered in the token registry.
                token_id: token_id,

                // Featured flag for UI highlighting
                // Featured markets will be displayed prominently in the UI
                // This can only be set to true by admins via the set_market_featured function
                featured: false,
            },
        );
        market_id
    });

    Ok(market_id)
}
