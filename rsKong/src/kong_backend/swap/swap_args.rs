use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapArgs {
    pub pay_token: String,
    pub pay_amount: Nat,
    pub pay_block_id: Option<Nat>,
    pub receive_token: String,
    pub receive_amount: Option<Nat>,
    pub receive_address: Option<String>,
    pub max_slippage: Option<f32>,
    pub referred_by: Option<String>,
}
