use crate::kong_backend::canister::block_id_reply::BlockIdReply;
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapTxReply {
    pub pool_symbol: String,
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_amount: Nat, // including fees
    pub price: f64,
    pub lp_fee: Nat,  // will be in receive_symbol
    pub gas_fee: Nat, // will be in receive_symbol
    pub ts: u64,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapReply {
    pub tx_id: u64,
    pub request_id: u64,
    pub status: String,
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_amount: Nat,
    pub mid_price: f64,
    pub price: f64,
    pub slippage: f64,
    pub txs: Vec<SwapTxReply>,
    pub block_ids: Vec<BlockIdReply>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}
