use crate::ic::guards::not_in_maintenance_mode;
use crate::ic::get_time::get_time;
use crate::stable_memory::{TX_24H_MAP, TX_ARCHIVE_MAP, TX_MAP};
use crate::stable_tx::stable_tx::StableTx;

pub fn archive_tx_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    TX_MAP.with(|tx_map| {
        for (tx_id, tx) in tx_map.borrow().iter() {
            TX_ARCHIVE_MAP.with(|tx_archive_map| {
                tx_archive_map.borrow_mut().insert(tx_id, tx);
            });
        }
    });
}

pub fn archive_tx_24h_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    let ts_start = get_time() - 86_400_000_000_000; // 24 hours
    TX_24H_MAP.with(|tx_24h_map| tx_24h_map.borrow_mut().clear_new());
    TX_MAP.with(|m| {
        TX_24H_MAP.with(|tx_24h_map| {
            for (tx_id, tx) in m.borrow().iter() {
                if let StableTx::Swap(swap_tx) = &tx {
                    if swap_tx.ts < ts_start {
                        continue;
                    }
                    tx_24h_map.borrow_mut().insert(tx_id, tx);
                }
            }
        });
    });
}
