use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

use super::stable_kong_settings::StableKongSettings;

use crate::canister::id::kong_backend_id;
use crate::KONG_SETTINGS;

pub fn get() -> StableKongSettings {
    KONG_SETTINGS.with(|s| s.borrow().get().clone())
}

pub fn set_kong_backend_id() -> Result<(), String> {
    let canister_id = kong_backend_id();
    let kong_backend_id = canister_id.clone();
    let kong_backend_principal = Principal::from_text(canister_id).map_err(|e| e.to_string())?;
    let kong_backend_account = Account::from(kong_backend_principal);
    let new_kong_settings = StableKongSettings {
        kong_backend_id,
        kong_backend_account,
        ..get() // copy the rest of the settings
    };
    insert(new_kong_settings.clone())
}

pub fn insert(settings: StableKongSettings) -> Result<(), String> {
    KONG_SETTINGS
        .with(|s| s.borrow_mut().set(settings))
        .map_or_else(|_| Err("Failed to insert Kong settings".to_string()), |_| Ok(()))
}

pub fn inc_request_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let new_kong_settings = StableKongSettings {
            request_map_idx: kong_settings.request_map_idx + 1,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings.clone());
        new_kong_settings.request_map_idx
    })
}
