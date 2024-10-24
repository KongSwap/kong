use crate::ic::get_time::get_time;
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{TRANSFER_1H_MAP, TRANSFER_ARCHIVE_MAP, TRANSFER_MAP};

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

pub fn remove_transfer_1h_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // remove transfers older than 1 hour
    let ts_start = get_time() - 3_600_000_000_000; // 1 hour
    TRANSFER_1H_MAP.with(|transfer_map| {
        let mut map = transfer_map.borrow_mut();
        let keys_to_remove: Vec<_> = map
            .iter()
            .filter(|(_, transfer)| transfer.ts < ts_start)
            .map(|(transfer_id, _)| transfer_id)
            .collect();

        for transfer_id in keys_to_remove {
            map.remove(&transfer_id);
        }
    });
}
