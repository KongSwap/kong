use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub struct ICReply {
    pub token_id: u32,
    pub pool_symbol: String,
    pub name: String,
    pub chain: String,
    pub symbol: String,
    pub token: String,
    pub canister_id: String,
    pub decimals: u8,
    pub fee: Nat,
    pub icrc1: bool,
    pub icrc2: bool,
    pub icrc3: bool,
    pub on_kong: bool,
}
