use ic_cdk::{query, update};
use std::cmp::max;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::ic::network::ICNetwork;
use crate::stable_memory::{TX_ARCHIVE_MAP, TX_MAP};
use crate::stable_tx::stable_tx::{StableTx, StableTxId};
use crate::stable_tx::tx::Tx;
use crate::stable_tx::tx_archive::archive_tx_map;

const MAX_TXS: usize = 1000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn max_txs_idx() -> u64 {
    TX_MAP.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.0))
}

/// serialize TX_ARCHIVE_MAP for backup
/// used for storing backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_txs(tx_id: Option<u64>, num_txs: Option<u16>) -> Result<String, String> {
    TX_ARCHIVE_MAP.with(|m| {
        let map = m.borrow();
        let txs: BTreeMap<_, _> = match tx_id {
            Some(tx_id) => {
                let start_id = StableTxId(tx_id);
                let num_txs = num_txs.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_txs).collect()
            }
            None => {
                let num_txs = num_txs.map_or(MAX_TXS, |n| n as usize);
                map.iter().take(num_txs).collect()
            }
        };
        serde_json::to_string(&txs).map_err(|e| format!("Failed to serialize txs: {}", e))
    })
}

/// deserialize StableTx and update TX_MAP
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_txs(stable_txs_json: String) -> Result<String, String> {
    let txs: BTreeMap<StableTxId, StableTx> = match serde_json::from_str(&stable_txs_json) {
        Ok(txs) => txs,
        Err(e) => return Err(format!("Invalid txs: {}", e)),
    };

    TX_MAP.with(|tx_map| {
        let mut map = tx_map.borrow_mut();
        for (k, v) in txs {
            map.insert(k, v);
        }
    });

    Ok("Txs updated".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn archive_txs() -> Result<String, String> {
    archive_tx_map();

    Ok("Txs archived".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn archive_txs_num() -> Result<String, String> {
    TX_MAP.with(|tx_map| {
        TX_ARCHIVE_MAP.with(|tx_archive_map| {
            let tx = tx_map.borrow();
            let mut tx_archive = tx_archive_map.borrow_mut();
            let start_tx_id = max(
                tx.first_key_value().map_or(0_u64, |(k, _)| k.0),
                tx_archive.last_key_value().map_or(0_u64, |(k, _)| k.0),
            );
            let end_tx_id = tx.last_key_value().map_or(0_u64, |(k, _)| k.0);
            for tx_id in start_tx_id..=end_tx_id {
                if let Some(tx) = tx.get(&StableTxId(tx_id)) {
                    tx_archive.insert(StableTxId(tx_id), tx);
                }
            }
        });
    });

    Ok("Txs archived num".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_txs() -> Result<String, String> {
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

    Ok("Txs removed".to_string())
}

/// remove archive txs older than ts
#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_txs(ts: u64) -> Result<String, String> {
    TX_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(_, v)| v.ts() < ts).map(|(k, _)| k).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive txs removed".to_string())
}

/// remove archive txs where tx_id <= tx_ids
#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_txs_ids(tx_ids: u64) -> Result<String, String> {
    TX_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(k, _)| k.0 <= tx_ids).map(|(k, _)| k).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive txs removed".to_string())
}
