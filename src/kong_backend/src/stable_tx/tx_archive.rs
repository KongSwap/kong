use crate::canister::guards::not_in_maintenance_mode;
use crate::{TX_ARCHIVE_MAP, TX_MAP};

pub fn archive_tx_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive txs
    TX_MAP.with(|tx_map| {
        for (tx_id, tx) in tx_map.borrow().iter() {
            TX_ARCHIVE_MAP.with(|tx_map_tmp| {
                tx_map_tmp.borrow_mut().insert(tx_id, tx);
            });
        }
    });
}
