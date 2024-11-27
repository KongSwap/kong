use candid::CandidType;
use ic_cdk::{query, update};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::ic::get_time::get_time;
use crate::ic::guards::caller_is_kingkong;
use crate::messages::message_reply::MessagesReply;
use crate::messages::message_reply_helpers::to_messages_reply;
use crate::stable_memory::MESSAGE_MAP;
use crate::stable_message::message_map;
use crate::stable_message::stable_message::{StableMessage, StableMessageId};

const MAX_MESSAGE: usize = 1_000;

/// serialize MESSAGE_MAP for backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_messages(message_id: Option<u64>, num_messages: Option<u16>) -> Result<String, String> {
    MESSAGE_MAP.with(|m| {
        let map = m.borrow();
        let messages: BTreeMap<_, _> = match message_id {
            Some(message_id) => {
                let start_id = StableMessageId(message_id);
                let num_messages = num_messages.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_messages).collect()
            }
            None => {
                let num_messages = num_messages.map_or(MAX_MESSAGE, |n| n as usize);
                map.iter().take(num_messages).collect()
            }
        };
        serde_json::to_string(&messages).map_err(|e| format!("Failed to serialize messages: {}", e))
    })
}

/// deserialize MESSAGE_MAP and update stable memory
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_messages(stable_messages: String) -> Result<String, String> {
    let messages: BTreeMap<StableMessageId, StableMessage> = match serde_json::from_str(&stable_messages) {
        Ok(tokens) => tokens,
        Err(e) => return Err(format!("Invalid messages: {}", e)),
    };

    MESSAGE_MAP.with(|message_map| {
        let mut map = message_map.borrow_mut();
        for (k, v) in messages {
            map.insert(k, v);
        }
    });

    Ok("Messages updated".to_string())
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn get_message(message_id: Option<u64>, user_id: Option<u32>, num_messages: Option<u16>) -> Result<Vec<MessagesReply>, String> {
    let num_messages = num_messages.map(|n| n as usize);
    let messages = message_map::get_by_message_id(message_id, user_id, num_messages)
        .iter()
        .map(to_messages_reply)
        .collect();
    Ok(messages)
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
    let message = message_map::get_by_message_id(Some(message_id), None, None);

    serde_json::to_string(&message).map_err(|e| format!("Failed to serialize: {}", e))
}
