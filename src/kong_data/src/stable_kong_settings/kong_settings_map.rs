use crate::stable_memory::KONG_SETTINGS;

use super::stable_kong_settings::StableKongSettings;

#[allow(dead_code)]
pub fn get<F, R>(f: F) -> R
where
    F: FnOnce(&StableKongSettings) -> R,
{
    KONG_SETTINGS.with(|s| f(s.borrow().get()))
}
