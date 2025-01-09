use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub struct LPReply {
    pub token_id: u32,
    pub chain: String,
    pub address: String,
    pub name: String,
    pub symbol: String,
    pub pool_id_of: u32,
    pub decimals: u8,
    pub fee: Nat,
    pub total_supply: Nat,
    pub is_removed: bool,
}
