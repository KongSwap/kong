use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::stable_message::stable_message::StableMessage;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct MessagesReply {
    pub message_id: u64,
    pub title: String,
    pub message: String,
    pub ts: u64,
}

// creates a MessagesReply from a StableRequest
// return Option so can be used in filter_map
pub fn to_messages_reply(message: &StableMessage) -> MessagesReply {
    MessagesReply {
        message_id: message.message_id,
        title: message.title.clone(),
        message: message.message.clone(),
        ts: message.ts,
    }
}
