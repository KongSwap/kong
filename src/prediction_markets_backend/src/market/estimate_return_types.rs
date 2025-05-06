use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

use crate::types::{MarketId, TokenAmount, OutcomeIndex, Timestamp};

/// Data point for time weight curve visualization
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TimeWeightPoint {
    pub relative_time: f64,      // Time as a fraction of market duration (0.0 to 1.0)
    pub absolute_time: Timestamp, // Actual timestamp
    pub weight: f64,             // Weight at this point
}

/// Data structure for estimated return scenarios
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EstimatedReturnScenario {
    pub scenario: String,
    pub probability: f64,
    pub min_return: TokenAmount,
    pub expected_return: TokenAmount,
    pub max_return: TokenAmount,
    pub time_weighted: bool,
    pub time_weight: Option<f64>,
}

/// Data structure for estimated bet return
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EstimatedReturn {
    pub market_id: MarketId,
    pub outcome_index: OutcomeIndex,
    pub bet_amount: TokenAmount,
    pub current_market_pool: TokenAmount,
    pub current_outcome_pool: TokenAmount,
    pub scenarios: Vec<EstimatedReturnScenario>,
    pub uses_time_weighting: bool,
    pub time_weight_alpha: Option<f64>,
    pub current_time: Timestamp,
    pub platform_fee_percentage: Option<u64>,
    pub estimated_platform_fee: Option<TokenAmount>,
}

/// Record of a bet payout, including time-weighting details if applicable
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BetPayoutRecord {
    pub market_id: MarketId,
    pub user: Principal,
    pub bet_amount: TokenAmount,
    pub payout_amount: TokenAmount,
    pub timestamp: Timestamp,
    pub outcome_index: OutcomeIndex,
    pub was_time_weighted: bool,
    pub time_weight: Option<f64>,
    pub original_contribution_returned: TokenAmount,
    pub bonus_amount: Option<TokenAmount>,
    pub platform_fee_amount: Option<TokenAmount>,
}
