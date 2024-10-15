use crate::canister::address::Address;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token_map;
use candid::{CandidType, Decode, Deserialize, Encode, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

const CLAIM_ID_SIZE: u32 = std::mem::size_of::<u64>() as u32;

#[derive(PartialEq, Eq, PartialOrd, Ord, Clone, Copy, Serialize)]
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

#[derive(CandidType, Debug, PartialEq, Eq, Clone, Serialize, Deserialize)]
pub enum ClaimStatus {
    Unclaimed,
    Claiming, // used as a caller guard to prevent reentrancy
    Claimed,
}

impl std::fmt::Display for ClaimStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClaimStatus::Unclaimed => write!(f, "Unclaimed"),
            ClaimStatus::Claiming => write!(f, "Claiming"),
            ClaimStatus::Claimed => write!(f, "Success"),
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
    pub request_id: Option<u64>, // optional to allow claims not associated with a request. ie. airdrops
    pub to_address: Option<Address>, // optional, will default to caller's principal id
    pub attempt_request_id: Vec<u64>,
    pub transfer_ids: Vec<u64>,
    pub ts: u64,
}

impl StableClaim {
    pub fn new(
        user_id: u32,
        token_id: u32,
        amount: &Nat,
        request_id: Option<u64>,
        to_address: Option<Address>,
        ts: u64,
    ) -> Self {
        Self {
            claim_id: 0, // will be set with insert_claim into CLAIM_MAP
            user_id,
            status: ClaimStatus::Unclaimed,
            token_id,
            amount: amount.clone(),
            request_id,
            to_address,
            attempt_request_id: Vec::new(),
            transfer_ids: Vec::new(),
            ts,
        }
    }

    pub fn get_token(&self) -> StableToken {
        token_map::get_by_token_id(self.token_id).unwrap()
    }
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
