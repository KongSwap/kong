use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::transfers::transfer_reply::TransferIdReply;

/// Data structure for the reply of the `add_pool` function.
/// Used in StableRequest
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddPoolReply {
    pub tx_id: u64,
    pub symbol: String,
    pub request_id: u64,
    pub status: String,
    pub chain_0: String,
    pub symbol_0: String,
    pub amount_0: Nat,
    pub balance_0: Nat,
    pub chain_1: String,
    pub symbol_1: String,
    pub amount_1: Nat,
    pub balance_1: Nat,
    pub add_lp_token_amount: Nat,
    pub lp_fee_bps: u8,
    pub lp_token_symbol: String,
    pub transfer_ids: Vec<TransferIdReply>,
    pub claim_ids: Vec<u64>,
    pub on_kong: bool,
    pub ts: u64,
}
