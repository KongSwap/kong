use crate::stable_memory::KONG_SETTINGS;

use super::stable_kong_settings::StableKongSettings;

pub fn get() -> StableKongSettings {
    KONG_SETTINGS.with(|s| s.borrow().get().clone())
}
