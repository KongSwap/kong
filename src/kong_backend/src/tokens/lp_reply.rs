use candid::{CandidType, Nat};
use serde::Serialize;

#[derive(CandidType, Serialize)]
pub struct LPReply {
    pub token_id: u32,
    pub pool_symbol: String,
    pub name: String,
    pub chain: String,
    pub symbol: String,
    pub token: String,
    pub address: String,
    pub pool_id_of: u32,
    pub decimals: u8,
    pub fee: Nat,
    pub total_supply: Nat,
    pub on_kong: bool,
}
