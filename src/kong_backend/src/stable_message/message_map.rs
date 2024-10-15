use super::stable_message::{StableMessage, StableMessageId};
use crate::stable_user::user_map::ALL_USERS_USER_ID;
use crate::{stable_user::user_map, MESSAGE_MAP};
use std::cmp::Reverse;

pub fn get_by_message_id(message_id: u64) -> Option<StableMessage> {
    let user_id = user_map::get_by_caller().ok().flatten()?.user_id;
    MESSAGE_MAP.with(|m| {
        m.borrow().iter().find_map(|(_, v)| {
            if v.message_id == message_id && (v.to_user_id == user_id || v.to_user_id == ALL_USERS_USER_ID) {
                Some(v)
            } else {
                None
            }
        })
    })
}

pub fn get(max_messages: Option<usize>) -> Vec<StableMessage> {
    let user_id = match user_map::get_by_caller() {
        Ok(Some(caller)) => caller.user_id,
        Ok(None) | Err(_) => return Vec::new(),
    };
    let mut messages: Vec<StableMessage> = MESSAGE_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| {
                if v.to_user_id == user_id || v.to_user_id == ALL_USERS_USER_ID {
                    Some(v)
                } else {
                    None
                }
            })
            .collect()
    });
    // order by timestamp in reverse order
    messages.sort_by_key(|message| Reverse(message.ts));

    if let Some(max_messages) = max_messages {
        messages.into_iter().take(max_messages).collect()
    } else {
        messages
    }
}

pub fn insert(message: &StableMessage) -> u64 {
    MESSAGE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        // with lock, increase message id key
        let message_id = map
            .iter()
            .map(|(k, _)| k.0)
            .max()
            .unwrap_or(0) // only if empty and first message
            + 1;
        let insert_message = StableMessage {
            message_id,
            ..message.clone()
        };
        map.insert(StableMessageId(message_id), insert_message);
        message_id
    })
}
