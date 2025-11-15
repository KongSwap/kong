use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::tokens::ic_reply::ICReply;

#[allow(dead_code)]
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum AddTokenReply {
    IC(ICReply),
}
