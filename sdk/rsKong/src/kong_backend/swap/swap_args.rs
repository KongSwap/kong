use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::kong_backend::transfers::tx_id::TxId;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapArgs {
    pub pay_token: String,
    pub pay_amount: Nat,
    pub pay_tx_id: Option<TxId>,
    pub receive_token: String,
    pub receive_amount: Option<Nat>,
    pub receive_address: Option<String>,
    pub max_slippage: Option<f64>,
    pub referred_by: Option<String>,
}
