// Central type definitions for the prediction markets backend
// This module consolidates all common types to ensure consistency

use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

// Re-export StorableNat for convenience
pub use crate::nat::StorableNat;

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

// Constants for conversions
pub const NANOS_PER_SECOND: u64 = 1_000_000_000;

// Market activation threshold - different for each token type
// Using a function rather than const due to limitations with non-const From trait
pub fn min_activation_bet(token_id: &TokenIdentifier) -> TokenAmount {
    // Default value for KONG remains 3000 KONG (with 8 decimals)
    let default_amount = TokenAmount::from(300_000_000_000u64);
    
    // Get token info
    let token_info = match crate::token::registry::get_token_info(token_id) {
        Some(info) => info,
        None => return default_amount, // If token not found, use default
    };
    
    // Set token-specific activation fees
    match token_info.symbol.as_str() {
        "KONG" => TokenAmount::from(300_000_000_000u64), // 3000 KONG (8 decimals)
        "ICP" | "ksICP" => TokenAmount::from(2_500_000_000u64), // 25 ICP (8 decimals)
        "ckUSDT" => TokenAmount::from(100_000_000u64), // 100 ckUSDT (6 decimals)
        "ksUSDT" => TokenAmount::from(100_000_000u64), // 100 ksUSDT (6 decimals)
        "ckUSDC" => TokenAmount::from(100_000_000u64), // 100 ckUSDC (6 decimals)
        "ckBTC" => TokenAmount::from(100_000u64), // 0.001 ckBTC (8 decimals)
        "DKP" => TokenAmount::from(7_000_000_000_000u64), // 70000 DKP (8 decimals)
        "GLDT" => TokenAmount::from(10_000_000_000u64), // 100 GLDT (8 decimals)
        _ => default_amount // Default to 3000 KONG equivalent for unknown tokens
    }
}

// Utility function to calculate platform fee based on token and amount
pub fn calculate_platform_fee(amount: &TokenAmount, token_id: &TokenIdentifier) -> TokenAmount {
    let token_info = match crate::token::registry::get_token_info(token_id) {
        Some(info) => info,
        None => return TokenAmount::from(0u64), // If token not found, no fee
    };

    let fee_percentage = token_info.fee_percentage;
    let amount_u64 = amount.to_u64();
    let fee_amount = (amount_u64 * fee_percentage) / 10000; // fee_percentage is in basis points (100 = 1%)
    
    TokenAmount::from(fee_amount)
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
    pub total_transfer_fees: TokenAmount,
    /// Distributable profit after fees
    pub distributable_profit: TokenAmount,
    /// Total weighted contribution (for time-weighted markets)
    pub total_weighted_contribution: Option<f64>,
    /// Per-bet distribution details
    pub distribution_details: Vec<BetDistributionDetail>,
    /// Any failed transactions that occurred during payout
    pub failed_transactions: Vec<FailedTransactionInfo>,
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
