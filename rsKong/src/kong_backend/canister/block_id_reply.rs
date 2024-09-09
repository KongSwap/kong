use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct BlockIdReply {
    pub is_send: bool,
    pub symbol: String,
    pub principal_id: String,
    pub block_id: Nat,
}
