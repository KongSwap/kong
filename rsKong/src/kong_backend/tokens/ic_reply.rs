use candid::{CandidType, Nat};
use serde::Deserialize;

#[derive(CandidType, Debug, Clone, Deserialize)]
pub struct ICReply {
    pub token_id: u32,
    pub pool_symbol: String,
    pub name: String,
    pub chain: String,
    pub symbol: String,
    pub address: String,
    pub decimals: u8,
    pub fee: Nat,
    pub icrc1: bool,
    pub icrc2: bool,
    pub icrc3: bool,
}
