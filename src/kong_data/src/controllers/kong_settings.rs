use ic_cdk::query;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::KONG_SETTINGS;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_kong_settings() -> Result<String, String> {
    let kong_settings = KONG_SETTINGS.with(|m| m.borrow().get().clone());
    serde_json::to_string(&kong_settings).map_err(|e| format!("Failed to serialize: {}", e))
}
