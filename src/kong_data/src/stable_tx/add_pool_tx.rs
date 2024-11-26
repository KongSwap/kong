use super::status_tx::StatusTx;
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddPoolTx {
    pub tx_id: u64,
    pub pool_id: u32,
    pub user_id: u32,
    pub request_id: u64,
    pub status: StatusTx,
    pub amount_0: Nat,
    pub amount_1: Nat,
    pub add_lp_token_amount: Nat,
    pub transfer_ids: Vec<u64>,
    pub claim_ids: Vec<u64>,
    pub on_kong: bool,
    pub ts: u64,
}
