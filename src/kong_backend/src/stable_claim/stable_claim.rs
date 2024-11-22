use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use crate::ic::address::Address;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableClaimId(pub u64);

impl Storable for StableClaimId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClaimStatus {
    Unclaimed,
    Claiming, // used as a caller guard to prevent reentrancy
    Claimed,
    TooManyAttempts,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableClaim {
    pub claim_id: u64,
    pub user_id: u32,
    pub status: ClaimStatus,
    pub token_id: u32,
    pub amount: Nat,
    pub request_id: Option<u64>,     // optional to allow claims not associated with a request. ie. airdrops
    pub to_address: Option<Address>, // optional, will default to caller's principal id
    pub attempt_request_id: Vec<u64>,
    pub transfer_ids: Vec<u64>,
    pub ts: u64,
}

impl Storable for StableClaim {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
