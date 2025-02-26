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
    UnclaimedOverride,
    Claimable, // claim where user needs to call claim() to get the token
}

impl std::fmt::Display for ClaimStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClaimStatus::Unclaimed => write!(f, "Unclaimed"),
            ClaimStatus::Claiming => write!(f, "Claiming"),
            ClaimStatus::Claimed => write!(f, "Success"),
            ClaimStatus::TooManyAttempts => write!(f, "TooManyAttempts"),
            ClaimStatus::UnclaimedOverride => write!(f, "UnclaimedOverride"),
            ClaimStatus::Claimable => write!(f, "Claimable"),
        }
    }
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
    pub desc: Option<String>,
    pub attempt_request_id: Vec<u64>,
    pub transfer_ids: Vec<u64>,
    pub ts: u64,
}

impl StableClaim {
    pub fn new(user_id: u32, token_id: u32, amount: &Nat, request_id: Option<u64>, to_address: Option<Address>, ts: u64) -> Self {
        Self {
            claim_id: 0, // will be set with insert_claim into CLAIM_MAP
            user_id,
            status: ClaimStatus::Unclaimed,
            token_id,
            amount: amount.clone(),
            request_id,
            to_address,
            desc: None,
            attempt_request_id: Vec::new(),
            transfer_ids: Vec::new(),
            ts,
        }
    }
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
