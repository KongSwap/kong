use ic_cdk::query;

use super::message_reply::{to_messages_reply, MessagesReply};

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_message::message_map;

const MAX_MESSAGES: usize = 10;

#[query(guard = "not_in_maintenance_mode")]
pub async fn messages(message_id: Option<u64>) -> Result<Vec<MessagesReply>, String> {
    Ok(match message_id {
        Some(message_id) => message_map::get_by_message_id(message_id).iter().map(to_messages_reply).collect(),
        None => message_map::get(MAX_MESSAGES).iter().map(to_messages_reply).collect(),
    })
}
