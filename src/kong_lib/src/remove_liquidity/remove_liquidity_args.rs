use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

/// Data structure for the arguments of the `remove_liquidity` function.
/// Used in StableRequest
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct RemoveLiquidityArgs {
    pub token_0: String,
    pub token_1: String,
    pub remove_lp_token_amount: Nat,
}
