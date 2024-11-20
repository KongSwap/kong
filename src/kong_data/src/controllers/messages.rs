use ic_cdk::{query, update};
use kong_lib::stable_message::stable_message::{StableMessage, StableMessageId};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::MESSAGE_MAP;

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
