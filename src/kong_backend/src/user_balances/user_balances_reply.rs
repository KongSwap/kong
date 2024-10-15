use candid::CandidType;
use serde::Serialize;

use super::lp_reply::LPReply;

#[derive(CandidType, Serialize)]
pub enum UserBalancesReply {
    LP(LPReply), // only return LP token balances for now
}
