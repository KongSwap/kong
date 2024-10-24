use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::add_liquidity::add_liquidity_args::AddLiquidityArgs;
use crate::add_pool::add_pool_args::AddPoolArgs;
use crate::remove_liquidity::remove_liquidity_args::RemoveLiquidityArgs;
use crate::send::send_args::SendArgs;
use crate::swap::swap_args::SwapArgs;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum Request {
    AddPool(AddPoolArgs),
    AddLiquidity(AddLiquidityArgs),
    RemoveLiquidity(RemoveLiquidityArgs),
    Swap(SwapArgs),
    Claim(u64),
    Send(SendArgs),
}
