use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use super::status_tx::StatusTx;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct RemoveLiquidityTx {
    pub tx_id: u64,
    pub pool_id: u32,
    pub request_id: u64,
    pub user_id: u32,
    pub status: StatusTx,
    pub amount_0: Nat,
    pub lp_fee_0: Nat,
    pub amount_1: Nat,
    pub lp_fee_1: Nat,
    pub remove_lp_token_amount: Nat,
    pub transfer_ids: Vec<u64>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}
