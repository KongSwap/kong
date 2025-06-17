use candid::Principal;

use crate::stable_memory::KONG_SETTINGS;
use crate::stable_user::user_map;

use super::network::ICNetwork;

// Authorized proxy principals
const PROXY_PRINCIPAL_ONE: &str = "6d7py-dit3v-5kk25-r7dci-gtr3f-rbxl7-m5oxw-7rhyu-4pmpp-j4lj2-lqe";
const PROXY_PRINCIPAL_TWO: &str = "xlotz-rhc3l-wkpkp-yzvau-ww2qy-zftze-2wrpx-pzcd2-fqa4t-3n36y-rae";

/// guard to make sure KongSwap is not in maintenance mode
pub fn not_in_maintenance_mode() -> Result<(), String> {
    if KONG_SETTINGS.with(|s| s.borrow().get().maintenance_mode) {
        return Err("KongSwap in maintenance mode".to_string());
    }
    Ok(())
}

/// guard to make sure caller is King Kong
pub fn caller_is_kingkong() -> Result<(), String> {
    // Controllers are maintainers as well
    if ICNetwork::is_caller_controller() {
        return Ok(());
    }
    let user_id = user_map::get_by_caller()?.ok_or("Caller is not King Kong")?.user_id;
    if !KONG_SETTINGS.with(|s| s.borrow().get().kingkong.contains(&user_id)) {
        return Err("Caller is not King Kong".to_string());
    }
    Ok(())
}

/// Guard that checks if the caller is the proxy
pub fn caller_is_proxy() -> Result<(), String> {
    let caller = ICNetwork::caller();
    if caller == Principal::from_text(PROXY_PRINCIPAL_ONE).unwrap() || caller == Principal::from_text(PROXY_PRINCIPAL_TWO).unwrap() {
        Ok(())
    } else {
        Err("Caller is not the proxy".to_string())
    }
}
