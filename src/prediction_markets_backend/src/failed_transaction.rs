use crate::token::registry::TokenIdentifier;
use crate::types::{MarketId, TokenAmount};
use candid::{CandidType, Deserialize, Principal};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

/// Record of a failed transaction for potential recovery
///
/// This structure stores all relevant information about a failed transaction
/// to facilitate later recovery attempts. It includes the recipient, amount,
/// token details, error information, and tracking metadata for resolution status.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedTransaction {
    /// Optional market ID associated with this transaction (None for non-market transactions)
    pub market_id: Option<MarketId>,
    /// Principal ID of the user who should receive the tokens
    pub recipient: Principal,
    /// Amount of tokens to be transferred (in raw token units including decimals)
    pub amount: TokenAmount,
    /// Identifier for the token type being transferred
    pub token_id: TokenIdentifier,
    /// Detailed error message explaining why the transaction failed
    pub error: String,
    /// Transaction creation timestamp (nanoseconds since 1970-01-01) - also used as unique ID
    pub timestamp: u64,
    /// Number of times the system has attempted to retry this transaction
    pub retry_count: u8,
    /// Whether this transaction has been successfully resolved
    pub resolved: bool,
}

impl Storable for FailedTransaction {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
