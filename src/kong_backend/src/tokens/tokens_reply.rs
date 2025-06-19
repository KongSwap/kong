use candid::CandidType;
use serde::{Deserialize, Serialize};

use super::ic_reply::ICReply;
use super::lp_reply::LPReply;
use super::solana_reply::SolanaReply;

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub enum TokensReply {
    LP(LPReply),
    IC(ICReply),
    Solana(SolanaReply),
}
