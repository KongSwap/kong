use ic_cdk::{query, update};
use kong_lib::stable_kong_settings::stable_kong_settings::StableKongSettings;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::KONG_SETTINGS;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_kong_settings() -> Result<String, String> {
    let kong_settings = KONG_SETTINGS.with(|m| m.borrow().get().clone());
    serde_json::to_string(&kong_settings).map_err(|e| format!("Failed to serialize: {}", e))
}

/// deserialize KONG_SETTINGS and update stable memory
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_kong_settings(kong_settings: String) -> Result<String, String> {
    let kong_settings: StableKongSettings = match serde_json::from_str(&kong_settings) {
        Ok(kong_settings) => kong_settings,
        Err(e) => return Err(format!("Invalid Kong settings: {}", e)),
    };

    KONG_SETTINGS.with(|s| {
        _ = s.borrow_mut().set(kong_settings);
    });

    Ok("Kong settings updated".to_string())
}
