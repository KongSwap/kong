use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct PoolsReply {
    pub pools: Vec<PoolReply>,
    pub total_tvl: Nat,
    pub total_24h_volume: Nat,
    pub total_24h_lp_fee: Nat,
    pub total_24h_num_swaps: Nat,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct PoolReply {
    pub pool_id: u32,
    pub name: String,
    pub symbol: String,
    pub balance: Nat,
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
    pub rolling_24h_volume: Nat,
    pub rolling_24h_lp_fee: Nat,
    pub rolling_24h_num_swaps: Nat,
    pub rolling_24h_apy: f64,
    pub lp_token_symbol: String,
    pub lp_token_supply: Nat,
    pub total_volume: Nat,
    pub total_lp_fee: Nat,
    pub on_kong: bool,
}
