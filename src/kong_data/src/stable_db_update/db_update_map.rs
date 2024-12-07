use super::stable_db_update::{StableDBUpdate, StableDBUpdateId};
use crate::stable_memory::DB_UPDATE_MAP;

pub fn insert(update: &StableDBUpdate) -> u64 {
    DB_UPDATE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let update_id = map.last_key_value().map_or(0, |(k, _)| k.0) + 1;
        let update = StableDBUpdate {
            update_id,
            ..update.clone()
        };
        map.insert(StableDBUpdateId(update_id), update.clone());
        update_id
    })
}

/// remove all update_id less than and equal to the given update_id
pub fn remove_old_update_id(update_id: u64) {
    DB_UPDATE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let mut remove_updates_ids = Vec::new();
        for (k, _) in map.iter() {
            if k.0 <= update_id {
                remove_updates_ids.push(k);
            }
        }
        for k in remove_updates_ids {
            map.remove(&k);
        }
    });
}
