use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{POOL_ARCHIVE_MAP, POOL_MAP};

pub fn archive_pool_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive pools
    POOL_MAP.with(|pool_map| {
        for (pool_id, pool) in pool_map.borrow().iter() {
            POOL_ARCHIVE_MAP.with(|pool_archive_map| {
                pool_archive_map.borrow_mut().insert(pool_id, pool);
            });
        }
    });
}
