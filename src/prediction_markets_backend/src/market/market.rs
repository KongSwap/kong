use candid::{CandidType, Nat, Principal};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

use crate::types::{MarketId, Timestamp, TokenAmount, PoolAmount, BetCount, TokenIdentifier, OutcomeIndex};

use crate::category::market_category::*;
use crate::resolution::resolution::*;

/// Represents the current status of a market
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum MarketStatus {
    Pending,          // Market is created but not yet activated
    Active,           // Market is active and open for betting (renamed from Open)
    Closed(Vec<Nat>), // Market is closed with winning outcome indices
    Disputed,         // Market result is disputed
    Voided,           // Market is voided, all bets returned to users
}

#[derive(CandidType, Deserialize)]
pub enum MarketEndTime {
    Duration(Timestamp),     // Duration in seconds from creation
    SpecificDate(Timestamp), // Unix timestamp for end date
}

/// Represents a prediction market with its properties
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Market {
    pub id: MarketId,
    pub creator: Principal,       // The creator's principal ID
    pub question: String,         // The question being predicted
    pub category: MarketCategory, // The market category
    pub rules: String,            // Competition rules defined by creator
    pub outcomes: Vec<String>,    // Possible outcomes
    pub resolution_method: ResolutionMethod,
    pub image_url: Option<String>, // Optional URL for market image
    pub status: MarketStatus,
    pub created_at: Timestamp,           // When the market was created
    pub end_time: Timestamp,             // When the market closes for betting
    pub total_pool: TokenAmount,         // Total amount of tokens in the market
    pub resolution_data: Option<String>, // Additional data for resolution (e.g., oracle signatures)
    pub outcome_pools: Vec<PoolAmount>,  // Amount in pool for each outcome
    pub outcome_percentages: Vec<f64>,   // Percentage of total pool for each outcome
    pub bet_counts: Vec<BetCount>,       // Number of bets for each outcome
    pub bet_count_percentages: Vec<f64>, // Percentage of total bets for each outcome
    pub resolved_by: Option<Principal>,  // Principal ID of the admin who resolved the market
    pub uses_time_weighting: bool,       // Whether this market uses time-weighted rewards
    pub time_weight_alpha: Option<f64>,  // Alpha parameter for exponential decay (default: 0.1)
    pub token_id: TokenIdentifier,       // The token used for this market
}

impl Storable for Market {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut buf = vec![];
        ciborium::ser::into_writer(self, &mut buf).expect("Failed to serialize Market");
        Cow::Owned(buf)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        ciborium::de::from_reader(bytes.as_ref()).expect("Failed to deserialize Market")
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Deserialize)]
pub struct Distribution {
    pub user: Principal,
    pub outcome_index: OutcomeIndex,
    pub bet_amount: TokenAmount,
    pub winnings: TokenAmount,
}

#[derive(CandidType, Deserialize)]
pub struct MarketResult {
    pub market: Market,
    pub winning_outcomes: Vec<OutcomeIndex>,
    pub total_pool: TokenAmount,
    pub winning_pool: TokenAmount,
    pub outcome_pools: Vec<PoolAmount>, // Amount in pool for each outcome
    pub outcome_percentages: Vec<f64>,   // Percentage of total pool for each outcome
    pub bet_counts: Vec<BetCount>,    // Number of bets for each outcome
    pub bet_count_percentages: Vec<f64>, // Percentage of total bets for each outcome
    pub distributions: Vec<Distribution>,
}

#[derive(CandidType, Deserialize)]
pub struct MarketsByStatus {
    pub active: Vec<Market>,
    pub expired_unresolved: Vec<Market>,
    pub resolved: Vec<MarketResult>,
}
