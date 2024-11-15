use crate::ic::get_time::get_time;
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{TRANSFER_1H_MAP, TRANSFER_ARCHIVE_MAP, TRANSFER_MAP};
use crate::stable_transfer::stable_transfer::StableTransferId;

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

    let two_days_ago = get_time() - 172_800_000_000_000; // 2 days
    let mut remove_list = Vec::new();
    TRANSFER_MAP.with(|transfer_map| {
        transfer_map.borrow().iter().for_each(|(transfer_id, transfer)| {
            if transfer.ts < two_days_ago {
                remove_list.push(transfer_id);
            }
        });
    });
    TRANSFER_MAP.with(|transfer_map| {
        remove_list.iter().for_each(|transfer_id| {
            transfer_map.borrow_mut().remove(transfer_id);
        });
    });
}

pub fn remove_transfer_1h_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    let ts_start = get_time() - 3_600_000_000_000; // 1 hour
    TRANSFER_1H_MAP.with(|transfer_map| {
        let mut map = transfer_map.borrow_mut();
        let keys_to_remove: Vec<_> = map
            .iter()
            .filter(|(_, transfer)| transfer.ts < ts_start)
            .map(|(transfer_id, _)| transfer_id)
            .collect();
        keys_to_remove.iter().for_each(|transfer_id| {
            map.remove(transfer_id);
        });
    });
}
