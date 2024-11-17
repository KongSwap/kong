use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{USER_ARCHIVE_MAP, USER_MAP};

pub fn archive_user_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive users
    USER_MAP.with(|user_map| {
        for (user_id, user) in user_map.borrow().iter() {
            USER_ARCHIVE_MAP.with(|user_archive_map| {
                user_archive_map.borrow_mut().insert(user_id, user);
            });
        }
    });
}
