use super::status_tx::StatusTx;
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::swap::swap_calc::SwapCalc;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapTx {
    pub tx_id: u64,
    pub user_id: u32,
    pub request_id: u64,
    pub status: StatusTx,
    pub pay_token_id: u32,
    pub pay_amount: Nat,
    pub receive_token_id: u32,
    pub receive_amount: Nat,
    pub price: f64,
    pub mid_price: f64,
    pub slippage: f64,
    pub txs: Vec<SwapCalc>,
    pub transfer_ids: Vec<u64>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}
