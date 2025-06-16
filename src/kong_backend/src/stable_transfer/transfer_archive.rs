use crate::ic::guards::not_in_maintenance_mode;
use crate::ic::network::ICNetwork;
use crate::stable_memory::{TRANSFER_ARCHIVE_MAP, TRANSFER_MAP};

use super::stable_transfer::StableTransferId;

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

    // only keep transfers from the last hour
    let one_hour_ago = ICNetwork::get_time() - 3_600_000_000_000;
    let mut remove_list = Vec::new();
    TRANSFER_MAP.with(|transfer_map| {
        transfer_map.borrow().iter().for_each(|(transfer_id, transfer)| {
            if transfer.ts < one_hour_ago {
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
