use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use ic_stable_structures::{storable::Bound, Storable};
use std::borrow::Cow;

use crate::types::{MarketId, Timestamp, OutcomeIndex};

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
    MarketStillOpen,          // Market is still open for betting
    AlreadyResolved,
    InvalidOutcome,
    UpdateFailed,
    PayoutFailed,
    TransferError(String),
    VoidingFailed,            // Voiding operation failed
    AwaitingCreatorApproval,  // Waiting for market creator to approve resolution
    AwaitingAdminApproval,    // Waiting for admin to approve resolution
    ResolutionMismatch,       // Proposed resolution doesn't match existing proposal
    InvalidMarketStatus,      // Market is in invalid state for resolution
    ResolutionDisagreement,   // Admin and creator disagree on resolution - market voided
}

/// Represents a resolution proposal for a market
/// This is used in dual-approval system where both creator and admin must agree
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ResolutionProposal {
    pub market_id: MarketId,
    pub proposed_outcomes: Vec<OutcomeIndex>,
    pub creator_approved: bool,
    pub admin_approved: bool,
    pub creator: Principal,
    pub admin_approver: Option<Principal>,
    pub proposed_at: Timestamp,
}

impl Storable for ResolutionProposal {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = vec![];
        ciborium::ser::into_writer(self, &mut bytes).unwrap();
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        ciborium::de::from_reader(bytes.as_ref()).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
