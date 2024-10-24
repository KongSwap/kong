use candid::CandidType;
use serde::{Deserialize, Serialize};

use super::lp_reply::LPReply;

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub enum UserBalancesReply {
    LP(LPReply), // only return LP token balances for now
}
