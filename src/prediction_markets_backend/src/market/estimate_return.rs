use crate::market::market::*;
use crate::market::estimate_return_types::*;
use crate::nat::*;
use crate::utils::time_weighting::*;
use crate::stable_memory::*;

/// Estimate the potential return for a bet
pub fn estimate_bet_return(
    market: &Market,
    outcome_index: StorableNat,
    bet_amount: StorableNat,
    current_time: Timestamp,
) -> Result<EstimatedReturn, String> {
    // Validate market state
    if !matches!(market.status, MarketStatus::Open) {
        return Err("Market is not open for betting".to_string());
    }

    // Validate outcome index
    if outcome_index.to_u64() as usize >= market.outcomes.len() {
        return Err("Invalid outcome index".to_string());
    }

    // Calculate potential return based on current market state
    let outcome_idx = outcome_index.to_u64() as usize;
    
    // Get current pool for the selected outcome
    let current_outcome_pool = market.outcome_pools[outcome_idx].clone();
    
    // Calculate new outcome pool after this bet
    let new_outcome_pool = current_outcome_pool.clone() + bet_amount.clone();
    
    // Calculate new total pool after this bet
    let new_total_pool = market.total_pool.clone() + bet_amount.clone();
    
    // Calculate potential returns for different scenarios
    
    // Scenario 1: This outcome wins (and is the only winner)
    let mut winning_return = EstimatedReturnScenario {
        scenario: "This outcome wins".to_string(),
        probability: market.outcome_percentages[outcome_idx],
        min_return: bet_amount.clone(), // Guaranteed to get at least the bet amount back
        expected_return: StorableNat::from(0u64),
        max_return: StorableNat::from(0u64),
        time_weighted: false,
        time_weight: None,
    };
    
    // Calculate expected return if this outcome wins
    // In standard markets: (bet_amount / outcome_pool) * total_pool
    let standard_return_ratio = bet_amount.to_f64() / new_outcome_pool.to_f64();
    let standard_expected_return = (new_total_pool.to_u64() as f64 * standard_return_ratio) as u64;
    
    // For time-weighted markets, calculate the time-weighted return
    if market.uses_time_weighting {
        winning_return.time_weighted = true;
        
        // Calculate time weight for this bet
        let alpha = get_market_alpha(market);
        let weight = calculate_time_weight(
            market.created_at.to_u64(),
            market.end_time.to_u64(),
            current_time.to_u64(),
            alpha
        );
        winning_return.time_weight = Some(weight);
        
        // Get all existing bets for this outcome
        let existing_bets = BETS.with(|bets| {
            let bets = bets.borrow();
            if let Some(bet_store) = bets.get(&market.id) {
                bet_store
                    .0
                    .iter()
                    .filter(|bet| bet.outcome_index == outcome_index)
                    .cloned()
                    .collect::<Vec<_>>()
            } else {
                Vec::new()
            }
        });
        
        // Calculate weighted contributions for existing bets
        let mut total_weighted_contribution = 0.0;
        for bet in &existing_bets {
            let bet_weight = calculate_time_weight(
                market.created_at.to_u64(),
                market.end_time.to_u64(),
                bet.timestamp.to_u64(),
                alpha
            );
            total_weighted_contribution += calculate_weighted_contribution(
                bet.amount.to_f64(),
                bet_weight
            );
        }
        
        // Add this new bet's weighted contribution
        let this_bet_weighted_contribution = calculate_weighted_contribution(
            bet_amount.to_f64(),
            weight
        );
        total_weighted_contribution += this_bet_weighted_contribution;
        
        // Calculate the share of the bonus pool
        let total_outcome_bets = new_outcome_pool.to_u64() as f64;
        let bonus_pool = new_total_pool.to_u64() as f64 - total_outcome_bets;
        
        let bonus_share = if total_weighted_contribution > 0.0 {
            this_bet_weighted_contribution / total_weighted_contribution * bonus_pool
        } else {
            0.0
        };
        
        // Total reward = original bet + share of bonus pool
        let time_weighted_return = bet_amount.to_u64() as f64 + bonus_share;
        
        winning_return.expected_return = StorableNat::from(time_weighted_return as u64);
        winning_return.min_return = bet_amount.clone(); // Guaranteed original bet back
        winning_return.max_return = StorableNat::from((bet_amount.to_u64() as f64 + bonus_pool) as u64); // Max possible (if only bet)
    } else {
        // Standard return calculation
        winning_return.expected_return = StorableNat::from(standard_expected_return);
        winning_return.max_return = new_total_pool.clone();
    }
    
    // Scenario 2: This outcome loses
    let losing_return = EstimatedReturnScenario {
        scenario: "This outcome loses".to_string(),
        probability: 1.0 - market.outcome_percentages[outcome_idx],
        min_return: StorableNat::from(0u64),
        expected_return: StorableNat::from(0u64),
        max_return: StorableNat::from(0u64),
        time_weighted: false,
        time_weight: None,
    };
    
    // Create the final estimate
    let estimate = EstimatedReturn {
        market_id: market.id.clone(),
        outcome_index: outcome_index.clone(),
        bet_amount: bet_amount.clone(),
        current_market_pool: market.total_pool.clone(),
        current_outcome_pool: current_outcome_pool.clone(),
        scenarios: vec![winning_return, losing_return],
        uses_time_weighting: market.uses_time_weighting,
        time_weight_alpha: market.time_weight_alpha,
        current_time: current_time.clone(),
    };
    
    Ok(estimate)
}

/// Generate data points for visualizing the time weight curve
pub fn generate_time_weight_curve(
    market: &Market,
    points: usize
) -> Result<Vec<TimeWeightPoint>, String> {
    if !market.uses_time_weighting {
        return Err("Market does not use time weighting".to_string());
    }
    
    let alpha = get_market_alpha(market);
    let market_created_at = market.created_at.to_u64();
    let market_end_time = market.end_time.to_u64();
    
    if market_end_time <= market_created_at {
        return Err("Invalid market time range".to_string());
    }
    
    let market_duration = market_end_time - market_created_at;
    let interval = market_duration / points as u64;
    
    let mut curve_points = Vec::with_capacity(points + 1);
    
    // Add the starting point (t=0, weight=1.0)
    curve_points.push(TimeWeightPoint {
        relative_time: 0.0,
        absolute_time: Timestamp::from(market_created_at),
        weight: 1.0,
    });
    
    // Generate points along the curve
    for i in 1..points {
        let time = market_created_at + (i as u64 * interval);
        let relative_time = (time - market_created_at) as f64 / market_duration as f64;
        let weight = calculate_time_weight(market_created_at, market_end_time, time, alpha);
        
        curve_points.push(TimeWeightPoint {
            relative_time,
            absolute_time: Timestamp::from(time),
            weight,
        });
    }
    
    // Add the ending point (t=1, weight=alpha)
    curve_points.push(TimeWeightPoint {
        relative_time: 1.0,
        absolute_time: Timestamp::from(market_end_time),
        weight: alpha,
    });
    
    Ok(curve_points)
}

/// Simulate the weight of a bet at a specified future time
pub fn simulate_future_weight(
    market: &Market,
    bet_time: Timestamp,
    future_time: Timestamp
) -> Result<f64, String> {
    if !market.uses_time_weighting {
        return Err("Market does not use time weighting".to_string());
    }
    
    let alpha = get_market_alpha(market);
    let market_created_at = market.created_at.to_u64();
    let market_end_time = market.end_time.to_u64();
    
    if future_time.to_u64() < bet_time.to_u64() {
        return Err("Future time must be after bet time".to_string());
    }
    
    if bet_time.to_u64() < market_created_at || bet_time.to_u64() > market_end_time {
        return Err("Bet time must be within market duration".to_string());
    }
    
    let weight = calculate_time_weight(
        market_created_at,
        market_end_time,
        bet_time.to_u64(),
        alpha
    );
    
    Ok(weight)
}


