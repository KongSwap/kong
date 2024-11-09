use candid::Principal;
use kong_lib::ic::canister_address::KONG_BACKEND;
use kong_lib::ic::id::{caller, is_caller_controller};

use super::user_map;

use crate::stable_memory::KONG_SETTINGS;

/// guard to make sure caller is King Kong
pub fn caller_is_kingkong() -> Result<(), String> {
    // Controllers are maintainers as well
    if is_caller_controller() {
        return Ok(());
    }
    let user = user_map::get_by_caller().ok().flatten().unwrap_or_default();
    if !KONG_SETTINGS.with(|s| s.borrow().get().kingkong.iter().any(|k| *k == user.user_id)) {
        return Err("Caller is not King Kong".to_string());
    }
    Ok(())
}

/// Guard to ensure caller is a controller
#[allow(dead_code)]
pub fn caller_is_controller() -> Result<(), String> {
    if !is_caller_controller() {
        return Err("Caller is not a controller".to_string());
    }
    Ok(())
}

pub fn kong_backend() -> Principal {
    Principal::from_text(KONG_BACKEND).unwrap()
}

/// Guard to ensure caller is Kong backend
pub fn caller_is_kong_backend() -> Result<(), String> {
    if caller() != kong_backend() {
        return Err("Caller is not Kong backend".to_string());
    }
    Ok(())
}
