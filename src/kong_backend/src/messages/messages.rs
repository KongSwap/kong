use ic_cdk::query;

use super::message_reply::MessagesReply;
use super::message_reply_helpers::to_messages_reply;

use crate::ic::guards::not_in_maintenance_mode_and_caller_is_not_anonymous;
use crate::stable_message::message_map;
use crate::stable_user::user_map;

#[query(guard = "not_in_maintenance_mode_and_caller_is_not_anonymous")]
pub async fn messages(message_id: Option<u64>) -> Result<Vec<MessagesReply>, String> {
    let user_id = match user_map::get_by_caller() {
        Ok(Some(caller)) => caller.user_id,
        Ok(None) | Err(_) => return Ok(Vec::new()),
    };
    let messages = message_map::get_by_message_id(message_id, Some(user_id), None)
        .iter()
        .map(to_messages_reply)
        .collect();
    Ok(messages)
}
