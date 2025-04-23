use ic_cdk::{query, update};

use crate::stable_db_update::stable_db_update::{StableDBUpdate, StableDBUpdateId};
use crate::stable_memory::DB_UPDATE_MAP;

const MAX_BACKUP_DB_UPDATES: usize = 1_000;
const MAX_REMOVE_DB_UPDATES: usize = 20_000;

#[query(hidden = true)]
fn backup_db_updates(db_update_id: Option<u64>) -> Result<String, String> {
    DB_UPDATE_MAP.with(|m| {
        let map = m.borrow();
        let db_updates = match db_update_id {
            Some(db_update_id) => map
                .range(StableDBUpdateId(db_update_id)..)
                .take(MAX_BACKUP_DB_UPDATES)
                .map(|(_, v)| v)
                .collect::<Vec<StableDBUpdate>>(),
            None => map
                .iter()
                .take(MAX_BACKUP_DB_UPDATES)
                .map(|(_, v)| v)
                .collect::<Vec<StableDBUpdate>>(),
        };
        serde_json::to_string(&db_updates).map_err(|e| format!("Failed to serialize updates: {}", e))
    })
}

#[update(hidden = true)]
fn remove_db_updates(ts: u64) -> Result<String, String> {
    DB_UPDATE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map
            .iter()
            .filter(|(_, v)| v.ts < ts)
            .map(|(k, _)| k)
            .take(MAX_REMOVE_DB_UPDATES)
            .collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("DB updates removed".to_string())
}
