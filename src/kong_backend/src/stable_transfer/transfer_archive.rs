use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::TRANSFER_ARCHIVE_MAP;
use kong_lib::stable_transfer::stable_transfer::StableTransferId;
use transfer_lib::transfer_map;
use transfer_lib::stable_memory::TRANSFER_MAP;

pub fn archive_transfer_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive transfers
    TRANSFER_MAP.with(|transfer_map| {
        TRANSFER_ARCHIVE_MAP.with(|transfer_archive_map| {
            let transfer = transfer_map.borrow();
            let mut transfer_archive = transfer_archive_map.borrow_mut();
            let start_transfer_id = transfer_archive.last_key_value().map_or(0_u64, |(k, _)| k.0);
            let end_transfer_id = transfer.last_key_value().map_or(0_u64, |(k, _)| k.0);
            for transfer_id in start_transfer_id..=end_transfer_id {
                if let Some(transfer) = transfer.get(&StableTransferId(transfer_id)) {
                    transfer_archive.insert(StableTransferId(transfer_id), transfer);
                }
            }
        });
    });

    transfer_map::cleanup_transfer_map();
}
