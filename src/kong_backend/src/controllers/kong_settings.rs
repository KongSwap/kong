use ic_cdk::{query, update};

use crate::helpers::json_helpers;
use crate::ic::guards::caller_is_kingkong;
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_memory::KONG_SETTINGS;

/// serialize KONG_SETTINGS for backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_kong_settings() -> Result<String, String> {
    KONG_SETTINGS.with(|m| {
        let map = m.borrow();
        let kong_settings = map.get();
        serde_json::to_string(kong_settings).map_err(|e| format!("Failed to serialize: {}", e))
    })
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
