use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct PoolReply {
    pub pool_id: u32,
    pub name: String,
    pub symbol: String,
    pub chain_0: String,
    pub symbol_0: String,
    pub address_0: String,
    pub balance_0: Nat,
    pub lp_fee_0: Nat,
    pub chain_1: String,
    pub symbol_1: String,
    pub address_1: String,
    pub balance_1: Nat,
    pub lp_fee_1: Nat,
    pub price: f64,
    pub lp_fee_bps: u8,
    pub lp_token_symbol: String,
    pub is_removed: bool,
}
