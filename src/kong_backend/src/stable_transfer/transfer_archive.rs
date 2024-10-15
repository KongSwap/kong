use crate::canister::guards::not_in_maintenance_mode;
use crate::{TRANSFER_ARCHIVE_MAP, TRANSFER_MAP};

pub fn archive_transfer_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive transfers
    TRANSFER_MAP.with(|transfer_map| {
        for (transfer_id, transfer) in transfer_map.borrow().iter() {
            TRANSFER_ARCHIVE_MAP.with(|transfer_map_tmp| {
                transfer_map_tmp.borrow_mut().insert(transfer_id, transfer);
            });
        }
    });
}
