use ic_cdk::{query, update};
use kong_lib::stable_kong_settings::stable_kong_settings::StableKongSettings;

use super::guards::caller_is_kong_backend;
use super::stable_memory::KONG_SETTINGS;

//#[query(hidden = true, guard = "caller_is_kingkong")]
#[query(hidden = true)]
fn backup_kong_settings() -> Result<String, String> {
    let kong_settings = KONG_SETTINGS.with(|m| m.borrow().get().clone());
    serde_json::to_string(&kong_settings).map_err(|e| format!("Failed to serialize: {}", e))
}

//#[update(guard = "caller_is_kong_backend")]
#[update(hidden = true)]
fn archive_kong_settings(kong_settings: String) -> Result<String, String> {
    let kong_settings: StableKongSettings = match serde_json::from_str(&kong_settings) {
        Ok(kong_settings) => kong_settings,
        Err(e) => return Err(format!("Invalid Kong settings: {}", e)),
    };

    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        _ = map.set(kong_settings);
    });

    Ok("Kong settings archived".to_string())
}
