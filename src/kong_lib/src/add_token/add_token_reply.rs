use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::tokens::ic_reply::ICReply;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum AddTokenReply {
    IC(ICReply),
}
