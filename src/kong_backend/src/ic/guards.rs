use crate::stable_memory::KONG_SETTINGS;
use crate::stable_user::user_map;

use super::id::is_caller_controller;

/// guard to make sure Kong Swap is not in maintenance mode
pub fn not_in_maintenance_mode() -> Result<(), String> {
    if KONG_SETTINGS.with(|s| s.borrow().get().maintenance_mode) {
        return Err("Kong Swap in maintenance mode".to_string());
    }
    Ok(())
}

/// guard to make sure caller is King Kong
pub fn caller_is_kingkong() -> Result<(), String> {
    // Controllers are maintainers as well
    if is_caller_controller() {
        return Ok(());
    }
    let user_id = user_map::get_by_caller()?.ok_or("Caller is not King Kong")?.user_id;
    if !KONG_SETTINGS.with(|s| s.borrow().get().kingkong.contains(&user_id)) {
        return Err("Caller is not King Kong".to_string());
    }
    Ok(())
}
