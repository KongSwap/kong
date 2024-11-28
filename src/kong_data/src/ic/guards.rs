use candid::Principal;

use super::canister_address::KONG_BACKEND;
use super::id::{caller, is_caller_controller};

use crate::stable_memory::KONG_SETTINGS;
use crate::stable_user::user_map;

/// guard to make sure Kong Swap is not in maintenance mode
#[allow(dead_code)]
pub fn not_in_maintenance_mode() -> Result<(), String> {
    if KONG_SETTINGS.with(|s| s.borrow().get().maintenance_mode) {
        return Err("Kong Swap in maintenance mode".to_string());
    }
    Ok(())
}

/// guard to make sure caller is not anonymous and Kong Swap is not in maintenance mode
#[allow(dead_code)]
pub fn not_in_maintenance_mode_and_caller_is_not_anonymous() -> Result<(), String> {
    not_in_maintenance_mode().and_then(|_| caller_is_not_anonymous())
}

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

/// Guard to ensure caller is not anonymous
pub fn caller_is_not_anonymous() -> Result<(), String> {
    if caller() == Principal::anonymous() {
        return Err("Anonymous user".to_string());
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

#[allow(dead_code)]
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
