use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::tokens::ic_reply::ICReply;

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub enum UpdateTokenReply {
    IC(ICReply),
}
