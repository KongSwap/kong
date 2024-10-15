use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::kong_backend::transfers::transfers_reply::TransferIdReply;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddLiquidityReply {
    pub tx_id: u64,
    pub symbol: String,
    pub request_id: u64,
    pub status: String,
    pub chain_0: String,
    pub symbol_0: String,
    pub amount_0: Nat,
    pub chain_1: String,
    pub symbol_1: String,
    pub amount_1: Nat,
    pub add_lp_token_amount: Nat,
    pub transfer_ids: Vec<TransferIdReply>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}
