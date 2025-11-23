use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::add_liquidity::add_liquidity_reply::AddLiquidityReply;
use crate::claims::claim_reply::ClaimReply;
use crate::remove_liquidity::remove_liquidity_reply::RemoveLiquidityReply;
use crate::send::send_reply::SendReply;
use crate::swap::swap_reply::SwapReply;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum Reply {
    Pending,
    AddLiquidity(AddLiquidityReply),
    RemoveLiquidity(RemoveLiquidityReply),
    Swap(SwapReply),
    Claim(ClaimReply),
    Send(SendReply),
}
