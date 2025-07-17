// Central type definitions for the prediction markets backend
// This module consolidates all common types to ensure consistency

use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

// Re-export StorableNat for convenience
pub use crate::nat::StorableNat;
use crate::token::registry::TokenInfo;

use ic_stable_structures::{storable::Bound, Storable};
use std::borrow::Cow;

// Core type aliases
pub type MarketId = StorableNat;
pub type Timestamp = StorableNat;
pub type TokenAmount = StorableNat;
pub type OutcomeIndex = StorableNat;
pub type PoolAmount = StorableNat;
pub type BetCount = StorableNat;
pub type AccountIdentifier = candid::Principal;
// Token identifier is defined in registry, but we re-export it here
pub type TokenIdentifier = String;

// Define shared type for resolve_via_admin arguments
#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct ResolutionArgs {
    pub market_id: MarketId,
    pub winning_outcomes: Vec<OutcomeIndex>
}

// Constants for conversions
pub const NANOS_PER_SECOND: u64 = 1_000_000_000;

// Market activation threshold - different for each token type
// Using a function rather than const due to limitations with non-const From trait
pub fn min_activation_bet(token_info: &TokenInfo) -> TokenAmount {
    token_info.activation_fee.clone()
}

// Utility function to calculate platform fee based on token and amount
pub fn calculate_platform_fee(amount: &TokenAmount, token_id: &TokenIdentifier) -> TokenAmount {
    let token_info = match crate::token::registry::get_token_info(token_id) {
        Some(info) => info,
        None => return TokenAmount::from(0u64), // If token not found, no fee
    };

    let fee_percentage = token_info.fee_percentage;
    
    // Use arbitrary precision arithmetic instead of u64 to handle high-precision tokens like ckETH (18 decimals)
    // First multiply by fee_percentage, then divide by 10000
    let multiplied = amount.clone() * TokenAmount::from(fee_percentage);
    let fee_amount = multiplied / 10000u64; // Division by u64 is supported
    
    fee_amount
}

/// Comprehensive details about a market's resolution and payout distribution
#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct MarketResolutionDetails {
    /// The market ID
    pub market_id: MarketId,
    /// The winning outcomes indices
    pub winning_outcomes: Vec<OutcomeIndex>,
    /// Timestamp when the market was resolved
    pub resolution_timestamp: Timestamp,
    /// Total pool size (sum of all bets)
    pub total_market_pool: TokenAmount,
    /// Total amount bet on winning outcomes
    pub total_winning_pool: TokenAmount,
    /// Total profit from losing bets
    pub total_profit: TokenAmount,
    /// Platform fee amount collected
    pub platform_fee_amount: TokenAmount,
    /// Platform fee percentage applied
    pub platform_fee_percentage: u64,
    /// Transaction ID for the fee transfer (if applicable)
    pub fee_transaction_id: Option<u64>,
    /// Creator fee amount collected
    pub creator_fee_amount: TokenAmount,
    /// Creator fee percentage applied
    pub creator_fee_percentage: u64,
    // Claim id for market creation
    pub creator_claim_id: Option<u64>,
    /// Token ID used for the market
    pub token_id: String,
    /// Token symbol (e.g., "KONG")
    pub token_symbol: String,
    /// Number of winning bets processed
    pub winning_bet_count: u64,
    /// Whether time-weighted distribution was used
    pub used_time_weighting: bool,
    /// Alpha value used for time-weighting (if applicable)
    pub time_weight_alpha: Option<f64>,
    /// Total amount allocated for transfer fees
    // #[deprecated(since = "1.1.0", note = "Unknown value in the moment of market finalization")]
    // pub total_transfer_fees: TokenAmount,
    /// Distributable profit after fees
    pub distributable_profit: TokenAmount,
    /// Total weighted contribution (for time-weighted markets)
    pub total_weighted_contribution: Option<f64>,
    /// Per-bet distribution details
    pub distribution_details: Vec<BetDistributionDetail>,
    /// Any failed transactions that occurred during payout
    pub failed_transactions: Vec<FailedTransactionInfo>,
}

impl Storable for MarketResolutionDetails {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

/// Details about how a specific bet was paid out
#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct BetDistributionDetail {
    /// The user who placed the bet
    pub user: Principal,
    /// Original bet amount
    pub bet_amount: TokenAmount,
    /// Time weight applied (for time-weighted markets)
    pub time_weight: Option<f64>,
    /// Weighted contribution (for time-weighted markets)
    pub weighted_contribution: Option<f64>,
    /// Share of profit awarded
    pub bonus_amount: TokenAmount,
    /// Total payout amount (original bet + profit share)
    pub total_payout: TokenAmount,
    /// Outcome index that was bet on
    pub outcome_index: OutcomeIndex,
    /// Claim ID generated for this payout
    pub claim_id: Option<u64>,
}

/// Information about a failed transaction during market resolution
#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct FailedTransactionInfo {
    /// ID of the market associated with this transaction (optional as some failures might be system-wide)
    #[serde(default)]
    pub market_id: Option<MarketId>,
    /// The user who was to receive tokens
    pub user: Principal,
    /// The amount that failed to transfer
    pub amount: TokenAmount,
    /// Identifier for the token type (optional as it might be inferred from context)
    #[serde(default)]
    pub token_id: Option<String>,
    /// Error message from the failed transaction
    pub error: String,
    /// Transaction timestamp (optional as it might be inferred from context)
    #[serde(default)]
    pub timestamp: Option<Timestamp>,
}
