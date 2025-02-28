use candid::{CandidType, Nat, Principal};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

use crate::category::market_category::*;
use crate::nat::*;
use crate::resolution::resolution::*;

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
    pub status: MarketStatus,
    pub created_at: Timestamp,           // When the market was created
    pub end_time: Timestamp,             // When the market closes for betting
    pub total_pool: StorableNat,         // Total amount of tokens in the market
    pub resolution_data: Option<String>, // Additional data for resolution (e.g., oracle signatures)
    pub outcome_pools: Vec<StorableNat>, // Amount in pool for each outcome
    pub outcome_percentages: Vec<f64>,   // Percentage of total pool for each outcome
    pub bet_counts: Vec<StorableNat>,    // Number of bets for each outcome
    pub bet_count_percentages: Vec<f64>, // Percentage of total bets for each outcome
    pub resolved_by: Option<Principal>,  // Principal ID of the admin who resolved the market
}

/// Legacy Market struct for migration
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct LegacyMarket {
    id: MarketId,
    creator: Principal,
    question: String,
    category: MarketCategory,
    outcomes: Vec<String>,
    resolution_method: ResolutionMethod,
    status: MarketStatus,
    end_time: Timestamp,
    total_pool: u64,
    resolution_data: Option<String>,
}

impl From<LegacyMarket> for Market {
    fn from(legacy: LegacyMarket) -> Self {
        let outcome_count = legacy.outcomes.len();
        Market {
            id: legacy.id,
            creator: legacy.creator,
            question: legacy.question,
            category: legacy.category,
            rules: "No rules specified (Legacy market)".to_string(), // Default rules for old markets
            outcomes: legacy.outcomes,
            resolution_method: legacy.resolution_method,
            status: legacy.status,
            created_at: StorableNat::from(0u64), // Default for legacy markets
            end_time: legacy.end_time,
            total_pool: StorableNat::from(legacy.total_pool),
            resolution_data: legacy.resolution_data,
            outcome_pools: vec![StorableNat::from(0u64); outcome_count],
            outcome_percentages: vec![0.0; outcome_count],
            bet_counts: vec![StorableNat::from(0u64); outcome_count],
            bet_count_percentages: vec![0.0; outcome_count],
            resolved_by: None,
        }
    }
}

impl Storable for Market {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut buf = vec![];
        ciborium::ser::into_writer(self, &mut buf).expect("Failed to serialize Market");
        Cow::Owned(buf)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        // First try to deserialize as the current Market struct
        if let Ok(market) = ciborium::de::from_reader(bytes.as_ref()) {
            return market;
        }

        // If that fails, try to deserialize as LegacyMarket and convert
        match ciborium::de::from_reader(bytes.as_ref()) {
            Ok(legacy_market) => {
                let legacy: LegacyMarket = legacy_market;
                legacy.into()
            }
            Err(e) => {
                ic_cdk::trap(&format!("Failed to deserialize Market: {}", e));
            }
        }
    }

    const BOUND: Bound = Bound::Unbounded;
}

/// Represents the current status of a market
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MarketStatus {
    Open,             // Market is open for betting
    Closed(Vec<Nat>), // Market is closed with winning outcome indices
    Disputed,         // Market result is disputed
}

#[derive(CandidType, Deserialize)]
pub enum MarketEndTime {
    Duration(StorableNat),     // Duration in seconds from creation
    SpecificDate(StorableNat), // Unix timestamp for end date
}

#[derive(CandidType, Deserialize)]
pub struct Distribution {
    pub user: Principal,
    pub outcome_index: StorableNat,
    pub bet_amount: StorableNat,
    pub winnings: StorableNat,
}

#[derive(CandidType, Deserialize)]
pub struct MarketsByStatus {
    pub active: Vec<Market>,
    pub expired_unresolved: Vec<Market>,
    pub resolved: Vec<MarketResult>,
}

#[derive(CandidType, Deserialize)]
pub struct MarketResult {
    pub market: Market,
    pub winning_outcomes: Vec<StorableNat>,
    pub total_pool: StorableNat,
    pub winning_pool: StorableNat,
    pub outcome_pools: Vec<StorableNat>, // Amount in pool for each outcome
    pub outcome_percentages: Vec<f64>,   // Percentage of total pool for each outcome
    pub bet_counts: Vec<StorableNat>,    // Number of bets for each outcome
    pub bet_count_percentages: Vec<f64>, // Percentage of total bets for each outcome
    pub distributions: Vec<Distribution>,
}
