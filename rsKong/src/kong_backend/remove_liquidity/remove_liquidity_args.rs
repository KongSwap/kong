use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct RemoveLiquidityArgs {
    pub token0: String,
    pub token1: String,
    pub remove_lp_token_amount: Nat,
}
