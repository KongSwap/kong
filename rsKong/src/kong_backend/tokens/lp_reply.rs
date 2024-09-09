use candid::{CandidType, Nat};
use serde::Deserialize;

#[derive(CandidType, Debug, Clone, Deserialize)]
pub struct LPReply {
    pub token_id: u32,
    pub pool_symbol: String,
    pub name: String,
    pub chain: String,
    pub symbol: String,
    pub address: String,
    pub decimals: u8,
    pub fee: Nat,
    pub total_supply: Nat,
}
