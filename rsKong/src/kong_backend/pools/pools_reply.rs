use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Serialize, Deserialize)]
pub struct PoolsReply {
    pub pool_id: u32,
    pub name: String,
    pub symbol: String,
    pub balance: Nat,
    pub chain0: String,
    pub symbol0: String,
    pub address0: String,
    pub balance0: Nat,
    pub lp_fee0: Nat,
    pub chain1: String,
    pub symbol1: String,
    pub address1: String,
    pub balance1: Nat,
    pub lp_fee1: Nat,
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
}
