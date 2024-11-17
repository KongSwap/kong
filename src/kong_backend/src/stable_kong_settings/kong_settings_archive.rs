use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{KONG_SETTINGS, KONG_SETTINGS_ARCHIVE};

pub fn archive_kong_settings() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive kong settings
    KONG_SETTINGS.with(|kong_settings| {
        KONG_SETTINGS_ARCHIVE.with(|kong_settings_archive| {
            let _ = kong_settings_archive.borrow_mut().set(kong_settings.borrow().get().clone());
        });
    });
}
