use crate::ic::guards::not_in_maintenance_mode;
use crate::ic::network::ICNetwork;
use crate::stable_memory::{TX_ARCHIVE_MAP, TX_MAP};

use super::stable_tx::StableTxId;
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
                    tx_archive.insert(StableTxId(tx_id), tx);
                }
            }
        });
    });

    // only keep txs from the last hour
    let one_hour_ago = ICNetwork::get_time() - 3_600_000_000_000;
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
