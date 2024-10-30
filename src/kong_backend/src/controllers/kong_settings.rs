use ic_cdk::{query, update};

use crate::helpers::json_helpers;
use crate::ic::guards::caller_is_kingkong;
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_memory::KONG_SETTINGS;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_kong_settings() -> Result<String, String> {
    let kong_settings = KONG_SETTINGS.with(|m| m.borrow().get().clone());
    serde_json::to_string(&kong_settings).map_err(|e| format!("Failed to serialize: {}", e))
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn set_kong_settings(update_settings: String) -> Result<String, String> {
    // get current Kong settings
    let kong_settings_value = KONG_SETTINGS
        .with(|m| serde_json::to_value(m.borrow().get()))
        .map_err(|e| format!("Failed to serialize Kong settings: {}", e))?;

    // get updates and merge them into Kong settings
    let updates = serde_json::from_str(&update_settings).map_err(|e| format!("Failed to parse update Kong settings: {}", e))?;
    let mut kong_settings_value = kong_settings_value;
    json_helpers::merge(&mut kong_settings_value, &updates);

    let kong_settings: StableKongSettings =
        serde_json::from_value(kong_settings_value).map_err(|e| format!("Failed to parse updated Kong settings: {}", e))?;

    KONG_SETTINGS.with(|m| {
        m.borrow_mut()
            .set(kong_settings.clone())
            .map_err(|_| "Failed to update Kong settings".to_string())?;
        serde_json::to_string(&kong_settings).map_err(|e| format!("Failed to serialize: {}", e))
    })
}
