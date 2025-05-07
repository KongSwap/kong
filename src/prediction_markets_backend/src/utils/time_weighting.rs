//! # Time-weighted Reward Distribution
//! 
//! This module implements the time-weighted distribution system for prediction markets,
//! which rewards users who bet earlier with higher payouts. The system uses an
//! exponential weighting model where the weight decreases over time, creating an
//! incentive for users to commit to their predictions earlier.
//! 
//! The model uses the formula: w(t) = α^(t/T) where:
//! 
//! - t: time elapsed since market creation (when bet was placed)
//! - T: total market duration
//! - α: parameter controlling decay rate (default: 0.1)
//! 
//! With α = 0.1, a bet placed at the start of the market receives 10x the weight
//! of a bet placed at the end, significantly increasing the potential reward for
//! early bettors who make correct predictions.

use crate::market::market::*;
use crate::types::Timestamp;

/// Default alpha value for exponential weighting
/// 
/// This constant sets the default decay rate for the time-weighted distribution.
/// Lower values create steeper decay curves, increasing the reward advantage for
/// early bettors. With α = 0.1, a bet placed at market start gets weight = 1.0,
/// while a bet placed at market end gets weight = 0.1.
pub const DEFAULT_ALPHA: f64 = 0.1;

/// Calculates the time-based weight for a bet using exponential decay
/// 
/// This function computes the weight factor for a bet based on when it was placed
/// relative to the market's duration. Earlier bets receive higher weights, following
/// an exponential decay model. The weight is highest (1.0) at market creation and
/// decays to the alpha value at market end time.
/// 
/// The weight decreases exponentially with time according to the formula:
/// w(t) = α^(t/T)
/// 
/// Where:
/// - t: time elapsed since market creation (when bet was placed)
/// - T: total market duration
/// - α: parameter controlling decay rate (default: 0.1)
/// 
/// # Parameters
/// * `market_created_at` - Timestamp when the market was created
/// * `market_end_time` - Timestamp when the market closes for betting
/// * `bet_time` - Timestamp when the bet was placed
/// * `alpha` - Decay parameter (typically 0.1) controlling the steepness of decay
/// 
/// # Returns
/// * `f64` - Weight factor in range [alpha, 1.0]
/// 
/// # Examples
/// ```
/// // A bet placed at market creation gets weight 1.0
/// // A bet placed halfway through gets weight = 0.1^0.5 ≈ 0.316
/// // A bet placed at market end gets weight = 0.1^1.0 = 0.1
/// ```
pub fn calculate_time_weight(
    market_created_at: Timestamp,
    market_end_time: Timestamp,
    bet_time: Timestamp,
    alpha: f64
) -> f64 {
    // Handle edge cases
    if market_end_time.to_u64() <= market_created_at.to_u64() {
        return 1.0; // No time weighting if market duration is 0
    }
    
    let market_duration = market_end_time.to_u64() - market_created_at.to_u64();
    let relative_time = (bet_time.to_u64().saturating_sub(market_created_at.to_u64())) as f64 
                        / market_duration as f64;
                        
    // Clamp relative_time to [0, 1] to handle edge cases
    let clamped_time = relative_time.max(0.0).min(1.0);
                        
    // Apply exponential decay: w(t) = α^(t/T)
    alpha.powf(clamped_time)
}

/// Gets the effective alpha value for a market's time weighting
/// 
/// This function determines the appropriate alpha value to use for a market's
/// time-weighted distribution calculations. If the market doesn't use time
/// weighting, it returns 1.0 (no decay). Otherwise, it uses the market's
/// specified alpha value or the default if none is specified.
/// 
/// # Parameters
/// * `market` - Reference to the market to get alpha value for
/// 
/// # Returns
/// * `f64` - The effective alpha value for the market
///   - 1.0 for markets not using time weighting (equal weights for all bets)
///   - The market's custom alpha value if specified
///   - DEFAULT_ALPHA (0.1) if time weighting is enabled but no custom alpha is set
pub fn get_market_alpha(market: &Market) -> f64 {
    if !market.uses_time_weighting {
        return 1.0; // No decay for markets not using time weighting
    }
    
    market.time_weight_alpha.unwrap_or(DEFAULT_ALPHA)
}

/// Calculates the weighted contribution of a bet for reward distribution
/// 
/// This function computes the weighted stake of a bet for purposes of
/// determining the bet's share of the bonus pool in time-weighted distributions.
/// The weighted contribution is simply the product of the bet amount and
/// the time-based weight factor.
/// 
/// # Parameters
/// * `bet_amount` - Original amount of the bet (in floating point) 
/// * `weight` - Time-based weight factor from calculate_time_weight
/// 
/// # Returns
/// * `f64` - Weighted contribution value
/// 
/// # Formula
/// weighted_contribution = bet_amount × weight
/// 
/// This weighted contribution is used in the final payout formula:
/// reward = original_bet + (weighted_contribution / total_weighted_contributions) × bonus_pool
pub fn calculate_weighted_contribution(
    bet_amount: f64,
    weight: f64
) -> f64 {
    bet_amount * weight
}
