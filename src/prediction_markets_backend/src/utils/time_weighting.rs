use crate::market::market::*;
use crate::nat::*;

/// Default alpha value for exponential weighting
pub const DEFAULT_ALPHA: f64 = 0.1;

/// Calculate the time-based weight for a bet
/// 
/// The weight decreases exponentially with time according to the formula:
/// w(t) = α^(t/T)
/// 
/// Where:
/// - t: time elapsed since market creation (when bet was placed)
/// - T: total market duration
/// - α: parameter controlling decay rate (default: 0.1)
pub fn calculate_time_weight(
    market_created_at: u64,
    market_end_time: u64,
    bet_time: u64,
    alpha: f64
) -> f64 {
    // Handle edge cases
    if market_end_time <= market_created_at {
        return 1.0; // No time weighting if market duration is 0
    }
    
    let market_duration = market_end_time - market_created_at;
    let relative_time = (bet_time.saturating_sub(market_created_at)) as f64 
                        / market_duration as f64;
                        
    // Clamp relative_time to [0, 1] to handle edge cases
    let clamped_time = relative_time.max(0.0).min(1.0);
                        
    // Apply exponential decay: w(t) = α^(t/T)
    alpha.powf(clamped_time)
}

/// Get the effective alpha value for a market
pub fn get_market_alpha(market: &Market) -> f64 {
    if !market.uses_time_weighting {
        return 1.0; // No decay for markets not using time weighting
    }
    
    market.time_weight_alpha.unwrap_or(DEFAULT_ALPHA)
}

/// Calculate weighted contribution for a bet
pub fn calculate_weighted_contribution(
    bet_amount: f64,
    weight: f64
) -> f64 {
    bet_amount * weight
}
