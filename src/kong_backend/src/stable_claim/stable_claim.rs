use candid::{CandidType, Decode, Encode, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

use crate::ic::address::Address;

const CLAIM_ID_SIZE: u32 = std::mem::size_of::<u64>() as u32;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableClaimId(pub u64);

impl Storable for StableClaimId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.to_bytes() // u64 is already Storable
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(u64::from_bytes(bytes))
    }

    // u64 is fixed size
    const BOUND: Bound = Bound::Bounded {
        max_size: CLAIM_ID_SIZE,
        is_fixed_size: true,
    };
}

#[derive(CandidType, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClaimStatus {
    Unclaimed,
    Claiming, // used as a caller guard to prevent reentrancy
    Claimed,
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
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    // unbounded size
    const BOUND: Bound = Bound::Unbounded;
}
