use candid::{CandidType, Nat, Principal};
use serde::{Deserialize, Serialize};

use crate::chains::chains::IC_CHAIN;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct ICToken {
    pub token_id: u32,
    pub name: String,
    pub symbol: String,
    pub canister_id: Principal,
    pub decimals: u8,
    pub fee: Nat,
    pub icrc1: bool,
    pub icrc2: bool,
    pub icrc3: bool,
    pub is_removed: bool,
}

impl ICToken {
    pub fn chain(&self) -> String {
        IC_CHAIN.to_string()
    }
}
