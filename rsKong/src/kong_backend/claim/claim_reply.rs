use crate::kong_backend::canister::block_id_reply::BlockIdReply;
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct ClaimReply {
    pub claim_id: u64,
    pub status: String,
    pub symbol: String,
    pub amount: Nat,
    pub fee: Nat,
    pub to_address: String,
    pub block_ids: Vec<BlockIdReply>,
    pub ts: u64,
}
