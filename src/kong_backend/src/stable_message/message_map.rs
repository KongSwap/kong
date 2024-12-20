use std::ops::Bound;

use super::stable_message::{StableMessage, StableMessageId};

use crate::ic::logging::error_log;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::MESSAGE_MAP;

const MAX_MESSAGES: usize = 10;

pub fn get_by_message_id(start_message_id: Option<u64>, user_id: Option<u32>, num_messages: Option<usize>) -> Vec<StableMessage> {
    MESSAGE_MAP.with(|m| {
        let map = m.borrow();
        let start_message_id = start_message_id.unwrap_or(map.last_key_value().map_or(0, |(k, _)| k.0));
        let num_messages = match num_messages {
            Some(num_messages) => std::cmp::min(num_messages, MAX_MESSAGES),
            None => 1,
        };
        map.range((Bound::Unbounded, Bound::Included(&StableMessageId(start_message_id))))
            .rev()
            .filter_map(|(_, v)| {
                if let Some(user_id) = user_id {
                    if v.to_user_id != user_id {
                        return None;
                    }
                }
                Some(v)
            })
            .take(num_messages)
            .collect()
    })
}

pub fn insert(message: &StableMessage) -> Result<u64, String> {
    MESSAGE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let message_id = kong_settings_map::inc_message_map_idx();
        let insert_message = StableMessage {
            message_id,
            ..message.clone()
        };
        map.insert(StableMessageId(message_id), insert_message.clone());
        Ok(message_id)
    })
}

#[allow(dead_code)]
fn archive_message(message: StableMessage) {
    ic_cdk::spawn(async move {
        match serde_json::to_string(&message) {
            Ok(message_json) => {
                let kong_data = kong_settings_map::get().kong_data;
                match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_message", (message_json,))
                    .await
                    .map_err(|e| e.1)
                    .unwrap_or_else(|e| (Err(e),))
                    .0
                {
                    Ok(_) => (),
                    Err(e) => error_log(&format!("Failed to archive message_id#{}. {}", message.message_id, e)),
                }
            }
            Err(e) => error_log(&format!("Failed to serialize message_id #{}. {}", message.message_id, e)),
        }
    });
}
