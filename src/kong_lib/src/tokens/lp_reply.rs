use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub struct LPReply {
    pub token_id: u32,
    pub name: String,
    pub chain: String,
    pub symbol: String,
    pub address: String,
    pub pool_id_of: u32,
    pub decimals: u8,
    pub fee: Nat,
    pub total_supply: Nat,
    pub on_kong: bool,
}
