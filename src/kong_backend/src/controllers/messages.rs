use candid::CandidType;
use ic_cdk::{query, update};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::ic::get_time::get_time;
use crate::stable_memory::MESSAGE_MAP;
use crate::stable_message::message_map;
use crate::stable_message::stable_message::StableMessage;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_messages(message_id: Option<u64>) -> Result<String, String> {
    match message_id {
        Some(message_id) => MESSAGE_MAP.with(|m| {
            m.borrow().iter().find(|(k, _)| k.0 == message_id).map_or_else(
                || Err(format!("Message #{} not found", message_id)),
                |(k, v)| serde_json::to_string(&(k, v)).map_err(|e| format!("Failed to serialize message: {}", e)),
            )
        }),
        None => {
            let messages: BTreeMap<_, _> = MESSAGE_MAP.with(|m| m.borrow().iter().collect());
            serde_json::to_string(&messages).map_err(|e| format!("Failed to serialize messages: {}", e))
        }
    }
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddMessageArgs {
    pub to_user_id: u32,
    pub title: String,
    pub message: String,
}

#[update(hidden = true, guard = "caller_is_kingkong")]
async fn add_message(args: AddMessageArgs) -> Result<String, String> {
    let ts = get_time();
    let message = StableMessage::new(args.to_user_id, &args.title, &args.message, ts);
    let message_id = message_map::insert(&message);
    let message = message_map::get_by_message_id(message_id).ok_or_else(|| format!("Failed to add message {}", args.title))?;

    serde_json::to_string(&message).map_err(|e| format!("Failed to serialize: {}", e))
}
