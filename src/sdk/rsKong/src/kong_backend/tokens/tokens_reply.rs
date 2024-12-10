use super::ic_reply::ICReply;
use super::lp_reply::LPReply;
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Debug, Clone, Deserialize)]
pub enum TokensReply {
    LP(LPReply),
    IC(ICReply),
}
