use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::kong_backend::transfers::transfers_reply::TransferIdReply;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct ClaimReply {
    pub claim_id: u64,
    pub status: String,
    pub chain: String,
    pub symbol: String,
    pub amount: Nat,
    pub fee: Nat,
    pub to_address: String,
    pub transfer_ids: Vec<TransferIdReply>,
    pub ts: u64,
}
