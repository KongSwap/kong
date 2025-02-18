use crate::stable_memory::KONG_SETTINGS;

use super::stable_kong_settings::StableKongSettings;

pub fn get<F, R>(f: F) -> R
where
    F: FnOnce(&StableKongSettings) -> R,
{
    KONG_SETTINGS.with(|s| f(s.borrow().get()))
}

pub fn send_to_event_store() -> bool {
    get(|s| s.send_to_event_store)
}
