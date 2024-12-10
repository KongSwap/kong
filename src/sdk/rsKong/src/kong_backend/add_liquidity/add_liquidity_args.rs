use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::kong_backend::transfers::tx_id::TxId;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddLiquidityArgs {
    pub token_0: String,
    pub amount_0: Nat,
    pub tx_id_0: Option<TxId>,
    pub token_1: String,
    pub amount_1: Nat,
    pub tx_id_1: Option<TxId>,
}
