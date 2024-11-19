use crate::ic::get_time::get_time;
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{TX_24H_MAP, TX_ARCHIVE_MAP, TX_MAP};

use super::stable_tx::{StableTx, StableTxId};
use super::stable_tx_alt::{StableTxAlt, StableTxIdAlt};
use super::tx::Tx;

pub fn archive_tx_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive txs
    TX_MAP.with(|tx_map| {
        TX_ARCHIVE_MAP.with(|tx_archive_map| {
            let tx = tx_map.borrow();
            let mut tx_archive = tx_archive_map.borrow_mut();
            let start_tx_id = tx_archive.last_key_value().map_or(0_u64, |(k, _)| k.0);
            let end_tx_id = tx.last_key_value().map_or(0_u64, |(k, _)| k.0);
            for tx_id in start_tx_id..=end_tx_id {
                if let Some(tx) = tx.get(&StableTxId(tx_id)) {
                    let tx_id = StableTxIdAlt::from_stable_tx_id(&StableTxId(tx_id));
                    let tx = StableTxAlt::from_stable_tx(&tx);
                    tx_archive.insert(tx_id, tx);
                }
            }
        });
    });

    let one_hour_ago = get_time() - 3_600_000_000_000; // 1 hour
    let mut remove_list = Vec::new();
    TX_MAP.with(|tx_map| {
        tx_map.borrow().iter().for_each(|(tx_id, tx)| {
            if tx.ts() < one_hour_ago {
                remove_list.push(tx_id);
            }
        });
    });
    TX_MAP.with(|tx_map| {
        remove_list.iter().for_each(|tx_id| {
            tx_map.borrow_mut().remove(tx_id);
        });
    });
}

pub fn archive_tx_24h_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    let ts_start = get_time() - 86_400_000_000_000; // 24 hours
    TX_MAP.with(|tx_map| {
        let map = tx_map.borrow();
        TX_24H_MAP.with(|tx_24h_map| {
            let mut map_24h = tx_24h_map.borrow_mut();
            map_24h.clear_new();

            for (tx_id, tx) in map.iter() {
                if let StableTx::Swap(swap_tx) = tx.clone() {
                    if swap_tx.ts >= ts_start {
                        map_24h.insert(tx_id, tx);
                    }
                }
            }
        });
    });
}
