use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddLiquidityArgs {
    pub token0: String,
    pub amount0: Nat,
    pub block_id0: Option<Nat>,
    pub token1: String,
    pub amount1: Nat,
    pub block_id1: Option<Nat>,
}
