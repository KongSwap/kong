use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::tokens::ic_reply::ICReply;
use crate::tokens::solana_reply::SolanaReply;

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub enum UpdateTokenReply {
    IC(ICReply),
    Solana(SolanaReply),
}
