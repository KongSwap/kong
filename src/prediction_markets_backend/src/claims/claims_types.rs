//! # Claims Types
//! 
//! This module defines the core data structures for the claims system.

use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

use crate::types::{MarketId, TokenAmount, OutcomeIndex, TokenIdentifier};
use crate::canister::Timestamp;
use std::collections::HashMap;

/// Status of a claim record
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ClaimStatus {
    /// Claim is pending, ready to be processed
    Pending,
    /// Claim has been processed successfully
    Processed(ProcessDetails),
    /// Claim processing failed
    Failed(FailureDetails),
}

/// Details of a successfully processed claim
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ProcessDetails {
    /// When the claim was processed
    pub timestamp: Timestamp,
    /// Transaction ID from the token ledger
    pub transaction_id: Option<candid::Nat>,
}

/// Details of a failed claim processing attempt
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct FailureDetails {
    /// When the claim processing was attempted
    pub timestamp: Timestamp,
    /// Error message explaining the failure
    pub error_message: String,
    /// Number of retry attempts made
    pub retry_count: u8,
}

/// Type of the claim
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ClaimType {
    /// Claim for winning a bet
    WinningPayout {
        /// The user's original bet amount
        bet_amount: TokenAmount,
        /// The outcome indexes the user bet on
        outcomes: Vec<OutcomeIndex>,
        /// The fee paid to the platform
        platform_fee: Option<TokenAmount>,
    },
    /// Claim for a refund (e.g., from a voided market)
    Refund {
        /// The user's original bet amount
        bet_amount: TokenAmount,
        /// Reason for the refund
        reason: RefundReason,
    },
    /// Other types of claims (e.g., promotions, rewards)
    Other {
        /// Description of the claim
        description: String,
    },
}

/// Reason for a refund
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum RefundReason {
    /// Market was voided
    VoidedMarket,
    /// Market resolution was disputed
    Disputed,
    /// Transaction failed during automatic payout
    TransactionFailed,
    /// Other reason with description
    Other(String),
}

/// A record of a user's claim for winnings or refunds
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ClaimRecord {
    /// Unique identifier for the claim
    pub claim_id: u64,
    /// Principal ID of the user who can claim
    pub user: Principal,
    /// ID of the market associated with this claim
    pub market_id: MarketId,
    /// Type of the claim
    pub claim_type: ClaimType,
    /// Amount that can be claimed (in raw token units)
    pub claimable_amount: TokenAmount,
    /// Identifier of the token type
    pub token_id: TokenIdentifier,
    /// Status of the claim
    pub status: ClaimStatus,
    /// When the claim was created
    pub created_at: Timestamp,
    /// When the claim was last updated
    pub updated_at: Timestamp,
}

/// Summary of claimable amounts by token
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ClaimableSummary {
    /// Total claimable amount by token
    pub by_token: HashMap<TokenIdentifier, TokenAmount>,
    /// Number of pending claims
    pub pending_claim_count: u64,
}

/// Result of a claim processing operation
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ClaimResult {
    /// ID of the processed claim
    pub claim_id: u64,
    /// Result of the operation
    pub success: bool,
    /// Block index from the token ledger if successful
    pub block_index: Option<candid::Nat>,
    /// Error message if failed
    pub error: Option<String>,
}

/// Result of a batch claim operation
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BatchClaimResult {
    /// Results of individual claim operations
    pub results: Vec<ClaimResult>,
    /// Summary of successfully claimed amounts by token
    pub claimed_amounts: HashMap<TokenIdentifier, TokenAmount>,
    /// Count of successful claims
    pub success_count: u64,
    /// Count of failed claims
    pub failure_count: u64,
}
