use super::stable_update::{StableUpdate, StableUpdateId};
use crate::stable_memory::UPDATE_MAP;

pub fn insert(update: &StableUpdate) -> u64 {
    UPDATE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let update_id = map.last_key_value().map_or(0, |(k, _)| k.0) + 1;
        let update = StableUpdate {
            update_id,
            ..update.clone()
        };
        map.insert(StableUpdateId(update_id), update.clone());
        update_id
    })
}
