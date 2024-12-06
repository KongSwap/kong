use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::UPDATE_MAP;
use crate::stable_update::stable_update::{StableUpdate, StableUpdateId};
use ic_cdk::query;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_updates(update_id: Option<u64>) -> Result<String, String> {
    let updates: Vec<StableUpdate> = UPDATE_MAP.with(|m| {
        let map = m.borrow();
        let update_id = update_id.unwrap_or(0);
        let start_key = StableUpdateId(update_id);
        map.range(start_key..).map(|(_, v)| v).collect()
    });

    serde_json::to_string(&updates).map_err(|e| format!("Failed to serialize updates: {}", e))
}
