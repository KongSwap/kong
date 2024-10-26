use candid::Principal;
use kong_lib::ic::canister_address::KONG_BACKEND;
use kong_lib::ic::id::caller;

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
