use crate::kong_backend::add_liquidity::add_liquidity_args::AddLiquidityArgs;
use crate::kong_backend::add_liquidity::add_liquidity_reply::AddLiquidityReply;
use crate::kong_backend::claim::claim_reply::ClaimReply;
use crate::kong_backend::remove_liquidity::remove_liquidity_args::RemoveLiquidityArgs;
use crate::kong_backend::remove_liquidity::remove_liquidity_reply::RemoveLiquidityReply;
use crate::kong_backend::swap::swap_args::SwapArgs;
use crate::kong_backend::swap::swap_reply::SwapReply;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct RequestsReply {
    pub request_id: u64,
    pub statuses: Vec<String>,
    pub request: Request,
    pub reply: Reply,
    pub ts: u64,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum Request {
    AddLiquidity(AddLiquidityArgs),
    RemoveLiquidity(RemoveLiquidityArgs),
    Swap(SwapArgs),
    Claim(u64),
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum Reply {
    Pending,
    AddLiquidity(AddLiquidityReply),
    RemoveLiquidity(RemoveLiquidityReply),
    Swap(SwapReply),
    Claim(ClaimReply),
}
