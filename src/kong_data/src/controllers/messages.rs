use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::get_time::get_time;
use crate::ic::guards::{caller_is_kingkong, caller_is_kong_backend};
use crate::stable_memory::MESSAGE_MAP;
use crate::stable_message::stable_message::{StableMessage, StableMessageId};
use crate::stable_db_update::stable_db_update::{StableMemory, StableDBUpdate};
use crate::stable_db_update::db_update_map;

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

#[update(hidden = true, guard = "caller_is_kong_backend")]
fn update_message(stable_message_json: String) -> Result<String, String> {
    let message: StableMessage = match serde_json::from_str(&stable_message_json) {
        Ok(message) => message,
        Err(e) => return Err(format!("Invalid message: {}", e)),
    };

    MESSAGE_MAP.with(|message_map| {
        let mut map = message_map.borrow_mut();
        map.insert(StableMessageId(message.message_id), message.clone());
    });

    // add to UpdateMap for archiving to database
    let ts = get_time();
    let update = StableDBUpdate {
        db_update_id: 0,
        stable_memory: StableMemory::MessageMap(message),
        ts,
    };
    db_update_map::insert(&update);

    Ok("Message updated".to_string())
}
