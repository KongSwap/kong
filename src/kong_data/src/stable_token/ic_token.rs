use candid::{CandidType, Nat, Principal};
use serde::{Deserialize, Serialize};

use crate::chains::chains::IC_CHAIN;
use crate::ic::ledger::{get_decimals, get_fee, get_name, get_supported_standards, get_symbol};

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
    pub on_kong: bool,
}

impl ICToken {
    pub fn chain(&self) -> String {
        IC_CHAIN.to_string()
    }
}
