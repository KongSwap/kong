use crate::kong_backend::canister::block_id_reply::BlockIdReply;
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddLiquidityReply {
    pub tx_id: u64,
    pub symbol: String,
    pub request_id: u64,
    pub status: String,
    pub chain0: String,
    pub symbol0: String,
    pub amount0: Nat,
    pub chain1: String,
    pub symbol1: String,
    pub amount1: Nat,
    pub add_lp_token_amount: Nat,
    pub block_ids: Vec<BlockIdReply>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}
