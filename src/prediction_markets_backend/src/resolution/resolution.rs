use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Defines how a market can be resolved
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ResolutionMethod {
    Admin, // Only admin can resolve
    Oracle {
        oracle_principals: BTreeSet<Principal>, // Authorized oracle principals
        required_confirmations: candid::Nat,    // Number of confirmations needed
    },
    Decentralized {
        quorum: candid::Nat, // Required number of stake for resolution
    },
}

/// Possible errors during market resolution
#[derive(CandidType, Debug)]
pub enum ResolutionError {
    Unauthorized,
    MarketNotFound,
    InvalidMethod,
    MarketStillOpen, // New variant for timing-related errors
    AlreadyResolved,
    InvalidOutcome,
    UpdateFailed,
    PayoutFailed,
    TransferError(String),
}
