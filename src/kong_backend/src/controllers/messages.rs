use candid::CandidType;
use ic_cdk::{query, update};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::ic::get_time::get_time;
use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::MESSAGE_MAP;
use crate::stable_message::message_map;
use crate::stable_message::stable_message::{StableMessage, StableMessageId};

const MAX_MESSAGE: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_messages(message_id: Option<u64>, num_messages: Option<u16>) -> Result<String, String> {
    match message_id {
        Some(message_id) if num_messages.is_none() => MESSAGE_MAP.with(|m| {
            let key = StableMessageId(message_id);
            serde_json::to_string(&m.borrow().get(&key).map_or_else(
                || Err(format!("Message #{} not found", message_id)),
                |v| Ok(BTreeMap::new().insert(key, v)),
            )?)
            .map_err(|e| format!("Failed to serialize messages: {}", e))
        }),
        Some(message_id) => MESSAGE_MAP.with(|m| {
            let num_messages = num_messages.map_or(MAX_MESSAGE, |n| n as usize);
            let start_key = StableMessageId(message_id);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .collect::<BTreeMap<_, _>>()
                    .range(start_key..)
                    .take(num_messages)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize messages: {}", e))
        }),
        None => MESSAGE_MAP.with(|m| {
            let num_messages = num_messages.map_or(MAX_MESSAGE, |n| n as usize);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .take(num_messages)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize messages: {}", e))
        }),
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
