use candid::Nat;

use super::stable_claim::{ClaimStatus, StableClaim};

use crate::ic::address::Address;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token_map;

impl std::fmt::Display for ClaimStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClaimStatus::Unclaimed => write!(f, "Unclaimed"),
            ClaimStatus::Claiming => write!(f, "Claiming"),
            ClaimStatus::Claimed => write!(f, "Success"),
            ClaimStatus::TooManyAttempts => write!(f, "TooManyAttempts"),
        }
    }
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
            attempt_request_id: Vec::new(),
            transfer_ids: Vec::new(),
            ts,
        }
    }

    pub fn get_token(&self) -> StableToken {
        token_map::get_by_token_id(self.token_id).unwrap()
    }
}
