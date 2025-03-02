use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::transfers::transfer_reply::TransferIdReply;

/// Data structure for the reply of the `claim` function.
/// Used in StableRequest
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct ClaimReply {
    pub claim_id: u64,
    pub status: String,
    pub chain: String,
    pub symbol: String,
    pub amount: Nat,
    pub fee: Nat,
    pub to_address: String,
    pub desc: String,
    pub transfer_ids: Vec<TransferIdReply>,
    pub ts: u64,
}
