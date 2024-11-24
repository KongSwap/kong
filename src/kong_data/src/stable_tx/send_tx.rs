use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use super::status_tx::StatusTx;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SendTx {
    pub tx_id: u64,
    pub user_id: u32,
    pub request_id: u64,
    pub status: StatusTx,
    pub to_user_id: u32,
    pub token_id: u32,
    pub amount: Nat,
    pub ts: u64,
}

impl SendTx {
    #[allow(clippy::too_many_arguments)]
    pub fn new_success(user_id: u32, request_id: u64, to_user_id: u32, token_id: u32, amount: &Nat, ts: u64) -> Self {
        Self {
            tx_id: 0,
            user_id,
            request_id,
            status: StatusTx::Success,
            to_user_id,
            token_id,
            amount: amount.clone(),
            ts,
        }
    }
}
