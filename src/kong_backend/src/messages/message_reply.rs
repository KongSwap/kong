use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct MessagesReply {
    pub message_id: u64,
    pub title: String,
    pub message: String,
    pub ts: u64,
}
