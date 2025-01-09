use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::transfers::transfer_reply::TransferIdReply;

/// Data structure for the reply of the `remove_liquidity` function.
/// Used in StableRequest
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct RemoveLiquidityReply {
    pub tx_id: u64,
    pub request_id: u64,
    pub status: String,
    pub symbol: String,
    pub chain_0: String,
    #[serde(default = "empty_string")]
    pub address_0: String,
    pub symbol_0: String,
    pub amount_0: Nat,
    pub lp_fee_0: Nat,
    pub chain_1: String,
    #[serde(default = "empty_string")]
    pub address_1: String,
    pub symbol_1: String,
    pub amount_1: Nat,
    pub lp_fee_1: Nat,
    pub remove_lp_token_amount: Nat,
    pub transfer_ids: Vec<TransferIdReply>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}

fn empty_string() -> String {
    String::new()
}
