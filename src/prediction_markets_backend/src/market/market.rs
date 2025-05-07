//! # Prediction Market Core Structures
//!
//! This module defines the core data structures for the Kong Swap prediction markets system.
//! It includes the market structure, market status tracking, and distribution calculations
//! for payouts and statistics.
//!
//! Markets can be created by both users and admins, with different resolution flows:
//! - Admin-created markets can be directly resolved by any admin
//! - User-created markets require dual approval between the creator and an admin
//!
//! The system supports both standard payout distributions and time-weighted distributions,
//! where earlier bettors receive higher rewards through an exponential weighting model.

use candid::{CandidType, Nat, Principal};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

use crate::types::{MarketId, Timestamp, TokenAmount, PoolAmount, BetCount, TokenIdentifier, OutcomeIndex};

use crate::category::market_category::*;
use crate::resolution::resolution::*;

/// Represents the current status of a market
/// 
/// This enum tracks the lifecycle of a prediction market from creation through
/// resolution or voiding. The status determines what operations are allowed on
/// a market (e.g., betting, resolving, disputing).
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum MarketStatus {
    /// Market is created but not yet activated (awaiting initial bets/funding)
    Pending,
    
    /// Market is active and open for betting
    /// Users can place bets on any outcome during this phase
    Active,
    
    /// Market is closed with winning outcome indices
    /// The Vec<Nat> contains the indices of winning outcomes (multiple possible for multi-select markets)
    Closed(Vec<Nat>),
    
    /// Market result is disputed
    /// This status is set when there's contention about the resolution
    Disputed,
    
    /// Market is voided, all bets returned to users
    /// This happens when resolution is impossible or when creator and admin disagree on outcome
    Voided,
}

/// Specifies how the market end time is determined
/// 
/// Markets can be configured to end either after a specific duration from creation
/// or at a specific calendar date/time.
#[derive(CandidType, Deserialize)]
pub enum MarketEndTime {
    /// Duration in seconds from market creation time
    /// Common for short-term markets (e.g., 24h, 48h, 7d markets)
    Duration(Timestamp),
    
    /// Unix timestamp for specific end date/time
    /// Used for markets tied to specific events with known schedule
    SpecificDate(Timestamp),
}

/// Represents a prediction market with its properties and state
/// 
/// This is the central data structure for the prediction markets system,
/// containing all metadata, financial state, and configuration parameters
/// for a market. The structure supports both regular and time-weighted markets,
/// as well as different resolution methods.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Market {
    /// Unique identifier for the market
    pub id: MarketId,
    
    /// Principal ID of the market creator (determines resolution flow)
    /// If creator is an admin, the market can be resolved directly by any admin
    /// Otherwise requires dual approval (creator + admin must agree on outcome)
    pub creator: Principal,
    
    /// The question or event being predicted
    pub question: String,
    
    /// Categorization of the market topic (Sports, Crypto, Politics, etc.)
    pub category: MarketCategory,
    
    /// Resolution rules defined by creator (how winning outcomes are determined)
    pub rules: String,
    
    /// List of possible outcomes users can bet on
    pub outcomes: Vec<String>,
    
    /// Method used to resolve the market (Admin, Oracle, or Decentralized)
    pub resolution_method: ResolutionMethod,
    
    /// Optional URL for market image/banner
    pub image_url: Option<String>,
    
    /// Current status of the market (Pending, Active, Closed, Disputed, Voided)
    pub status: MarketStatus,
    
    /// Timestamp when the market was created
    pub created_at: Timestamp,
    
    /// Timestamp when the market closes for betting
    /// After this time, no new bets can be placed and the market can be resolved
    pub end_time: Timestamp,
    
    /// Total amount of tokens in the market across all outcome pools
    pub total_pool: TokenAmount,
    
    /// Additional data for resolution (e.g., oracle signatures, evidence URLs)
    pub resolution_data: Option<String>,
    
    /// Amount of tokens bet on each outcome
    pub outcome_pools: Vec<PoolAmount>,
    
    /// Percentage of total pool bet on each outcome
    /// Used for UI display and payout calculations
    pub outcome_percentages: Vec<f64>,
    
    /// Count of bets placed on each outcome
    pub bet_counts: Vec<BetCount>,
    
    /// Percentage of total bet count for each outcome
    pub bet_count_percentages: Vec<f64>,
    
    /// Principal ID of the entity who resolved the market (if resolved)
    pub resolved_by: Option<Principal>,
    
    /// Whether this market uses time-weighted reward distribution
    /// When true, earlier bets receive higher payouts using exponential weighting
    pub uses_time_weighting: bool,
    
    /// Alpha parameter for exponential time weighting decay (default: 0.1)
    /// Lower values create steeper decay curves (greater advantage for early bettors)
    pub time_weight_alpha: Option<f64>,
    
    /// Identifier for the token used in this market (KONG, ICP, etc.)
    /// All bets and payouts use this token type
    pub token_id: TokenIdentifier
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

/// Represents the distribution of winnings to a specific user
/// 
/// This structure records the payout details for a single winning bet,
/// tracking who receives what amount and for which outcome.
#[derive(CandidType, Deserialize)]
pub struct Distribution {
    /// Principal ID of the user receiving the payout
    pub user: Principal,
    
    /// Index of the outcome they correctly bet on
    pub outcome_index: OutcomeIndex,
    
    /// Original amount the user bet
    pub bet_amount: TokenAmount,
    
    /// Amount of tokens the user receives as winnings
    /// For time-weighted markets, this includes the time-weighted bonus
    pub winnings: TokenAmount,
}

/// Comprehensive result data for a resolved market
/// 
/// This structure contains all information about a resolved market,
/// including the original market data, winning outcomes, and the
/// distribution of winnings to successful bettors.
#[derive(CandidType, Deserialize)]
pub struct MarketResult {
    /// The complete market data
    pub market: Market,
    
    /// Indices of the winning outcomes
    /// Multiple outcomes possible for multi-select markets
    pub winning_outcomes: Vec<OutcomeIndex>,
    
    /// Total tokens in the market pool across all outcomes
    pub total_pool: TokenAmount,
    
    /// Total tokens in the pool for winning outcome(s)
    pub winning_pool: TokenAmount,
    
    /// Amount of tokens bet on each outcome
    pub outcome_pools: Vec<PoolAmount>,
    
    /// Percentage distribution of bets across outcomes
    pub outcome_percentages: Vec<f64>,
    
    /// Count of bets placed on each outcome
    pub bet_counts: Vec<BetCount>,
    
    /// Percentage of total bets for each outcome
    pub bet_count_percentages: Vec<f64>,
    
    /// List of all winning distributions to users
    /// Records who received what payout for which outcome
    pub distributions: Vec<Distribution>,
}

/// Container for markets grouped by their status
/// 
/// This structure organizes markets into three major categories for UI display
/// and administrative operations. It's primarily used for dashboard views and
/// administrative interfaces.
#[derive(CandidType, Deserialize)]
pub struct MarketsByStatus {
    /// Currently active markets where users can place bets
    pub active: Vec<Market>,
    
    /// Markets whose end time has passed but haven't been resolved yet
    /// These markets are waiting for resolution by admins or oracles
    pub expired_unresolved: Vec<Market>,
    
    /// Markets that have been fully resolved with winning outcomes
    /// Includes complete payout distribution information
    pub resolved: Vec<MarketResult>,
}
