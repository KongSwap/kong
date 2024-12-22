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
    pub metadata: Option<String>,
    pub ts: u64,
}

impl AddPoolTx {
    #[allow(clippy::too_many_arguments)]
    pub fn new_success(
        pool_id: u32,
        user_id: u32,
        request_id: u64,
        amount_0: &Nat,
        amount_1: &Nat,
        add_lp_token_amount: &Nat,
        transfer_ids: &[u64],
        claim_ids: &[u64],
        on_kong: bool,
        metadata: Option<String>,
        ts: u64,
    ) -> Self {
        Self {
            tx_id: 0,
            pool_id,
            user_id,
            request_id,
            status: StatusTx::Success,
            amount_0: amount_0.clone(),
            amount_1: amount_1.clone(),
            add_lp_token_amount: add_lp_token_amount.clone(),
            transfer_ids: transfer_ids.to_vec(),
            claim_ids: claim_ids.to_vec(),
            on_kong,
            metadata,
            ts,
        }
    }
}
