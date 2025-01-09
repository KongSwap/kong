use crate::ic::guards::caller_is_kingkong;
use crate::stable_db_update::db_update_map;
use crate::stable_db_update::stable_db_update::{StableDBUpdate, StableDBUpdateId};
use crate::stable_memory::DB_UPDATE_MAP;
use ic_cdk::{query, update};

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_db_updates(update_id: Option<u64>) -> Result<String, String> {
    let db_updates: Vec<StableDBUpdate> = DB_UPDATE_MAP.with(|m| {
        let map = m.borrow();
        let update_id = update_id.unwrap_or(0);
        let start_key = StableDBUpdateId(update_id);
        map.range(start_key..).map(|(_, v)| v).collect()
    });

    serde_json::to_string(&db_updates).map_err(|e| format!("Failed to serialize updates: {}", e))
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_db_updates(update_id: u64) -> Result<String, String> {
    db_update_map::remove_old_updates(update_id);

    Ok("DB updates removed".to_string())
}
