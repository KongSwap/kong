use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

use crate::nat::*;

/// Data point for time weight curve visualization
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TimeWeightPoint {
    pub relative_time: f64,      // Time as a fraction of market duration (0.0 to 1.0)
    pub absolute_time: StorableNat, // Actual timestamp
    pub weight: f64,             // Weight at this point
}

/// Data structure for estimated return scenarios
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EstimatedReturnScenario {
    pub scenario: String,
    pub probability: f64,
    pub min_return: StorableNat,
    pub expected_return: StorableNat,
    pub max_return: StorableNat,
    pub time_weighted: bool,
    pub time_weight: Option<f64>,
}

/// Data structure for estimated bet return
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EstimatedReturn {
    pub market_id: MarketId,
    pub outcome_index: StorableNat,
    pub bet_amount: StorableNat,
    pub current_market_pool: StorableNat,
    pub current_outcome_pool: StorableNat,
    pub scenarios: Vec<EstimatedReturnScenario>,
    pub uses_time_weighting: bool,
    pub time_weight_alpha: Option<f64>,
    pub current_time: StorableNat,
}

/// Record of a bet payout, including time-weighting details if applicable
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BetPayoutRecord {
    pub market_id: MarketId,
    pub user: Principal,
    pub bet_amount: StorableNat,
    pub payout_amount: StorableNat,
    pub timestamp: StorableNat,
    pub outcome_index: StorableNat,
    pub was_time_weighted: bool,
    pub time_weight: Option<f64>,
    pub original_contribution_returned: StorableNat,
    pub bonus_amount: Option<StorableNat>,
}
