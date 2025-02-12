use ic_cdk::{query, update};

use crate::ic::get_time::get_time;
use crate::ic::guards::caller_is_kingkong;
use crate::stable_db_update::db_update_map;
use crate::stable_db_update::stable_db_update::{StableDBUpdate, StableMemory};
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_memory::KONG_SETTINGS;

#[query(hidden = true)]
fn backup_kong_settings() -> Result<String, String> {
    let kong_settings = KONG_SETTINGS.with(|m| m.borrow().get().clone());
    serde_json::to_string(&kong_settings).map_err(|e| format!("Failed to serialize: {}", e))
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_kong_settings(kong_settings: String) -> Result<String, String> {
    let kong_settings: StableKongSettings = match serde_json::from_str(&kong_settings) {
        Ok(kong_settings) => kong_settings,
        Err(e) => return Err(format!("Invalid Kong settings: {}", e)),
    };

    KONG_SETTINGS
        .with(|s| s.borrow_mut().set(kong_settings.clone()))
        .map_err(|e| format!("Failed updating Kong settings: {:?}", e))?;

    // add to UpdateMap for archiving to database
    let ts = get_time();
    let update = StableDBUpdate {
        db_update_id: 0,
        stable_memory: StableMemory::KongSettings(kong_settings),
        ts,
    };
    db_update_map::insert(&update);

    Ok("Kong settings updated".to_string())
}
