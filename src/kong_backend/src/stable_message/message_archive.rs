use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{MESSAGE_ARCHIVE_MAP, MESSAGE_MAP};

pub fn archive_message_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive messages
    MESSAGE_MAP.with(|message_map| {
        for (message_id, message) in message_map.borrow().iter() {
            MESSAGE_ARCHIVE_MAP.with(|message_archive_map| {
                message_archive_map.borrow_mut().insert(message_id, message);
            });
        }
    });
}
