use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::stable_claim::{StableClaim, StableClaimId};

use crate::ic::address::Address;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableClaimIdAlt(pub u64);

impl StableClaimIdAlt {
    pub fn from_stable_claim_id(stable_claim_id: &StableClaimId) -> Self {
        let claim_id_alt = serde_json::to_value(stable_claim_id).unwrap();
        serde_json::from_value(claim_id_alt).unwrap()
    }

    pub fn to_stable_claim_id(&self) -> StableClaimId {
        let claim_id_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(claim_id_alt).unwrap()
    }
}

impl Storable for StableClaimIdAlt {
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
pub struct StableClaimAlt {
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

impl StableClaimAlt {
    pub fn from_stable_claim(stable_claim: &StableClaim) -> Self {
        let claim_alt = serde_json::to_value(stable_claim).unwrap();
        serde_json::from_value(claim_alt).unwrap()
    }

    pub fn to_stable_claim(&self) -> StableClaim {
        let claim_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(claim_alt).unwrap()
    }
}

impl Storable for StableClaimAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
