use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{TOKEN_ARCHIVE_MAP, TOKEN_MAP};

pub fn archive_token_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive tokens
    TOKEN_MAP.with(|token_map| {
        for (token_id, token) in token_map.borrow().iter() {
            TOKEN_ARCHIVE_MAP.with(|token_archive_map| {
                token_archive_map.borrow_mut().insert(token_id, token);
            });
        }
    });
}
