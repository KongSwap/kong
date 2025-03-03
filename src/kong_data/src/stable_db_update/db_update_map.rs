use super::stable_db_update::{StableDBUpdate, StableDBUpdateId};
use crate::stable_memory::DB_UPDATE_MAP;

pub fn insert(db_update: &StableDBUpdate) -> u64 {
    DB_UPDATE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let db_update_id = map.last_key_value().map_or(1, |(k, _)| k.0 + 1);
        let db_update = StableDBUpdate {
            db_update_id,
            ..db_update.clone()
        };
        map.insert(StableDBUpdateId(db_update_id), db_update);
        db_update_id
    })
}

/// remove all update_id less than and equal to the given update_id
pub fn remove_old_updates(db_update_id: u64) {
    DB_UPDATE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let mut remove_db_updates_ids = Vec::new();
        for (k, _) in map.iter() {
            if k.0 <= db_update_id {
                remove_db_updates_ids.push(k);
            }
        }
        for k in remove_db_updates_ids {
            map.remove(&k);
        }
    });
}
