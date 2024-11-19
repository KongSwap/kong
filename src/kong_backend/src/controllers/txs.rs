use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::{TX_ARCHIVE_MAP, TX_MAP};
use crate::stable_tx::stable_tx::{StableTx, StableTxId};
use crate::stable_tx::stable_tx_alt::{StableTxAlt, StableTxIdAlt};
use crate::stable_tx::tx::Tx;
use crate::stable_tx::tx_map;
use crate::txs::txs_reply::TxsReply;
use crate::txs::txs_reply_impl::to_txs_reply;

const MAX_TXS: usize = 1_000;

/// serialize TX_MAP for backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_txs(tx_id: Option<u64>, num_txs: Option<u16>) -> Result<String, String> {
    TX_MAP.with(|m| {
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

#[query(hidden = true, guard = "caller_is_kingkong")]
pub fn get_txs(tx_id: Option<u64>, user_id: Option<u32>, token_id: Option<u32>) -> Result<Vec<TxsReply>, String> {
    let txs = match tx_id {
        Some(tx_id) => tx_map::get_by_tx_and_user_id(tx_id, user_id).into_iter().collect(),
        None => tx_map::get_by_user_and_token_id(user_id, token_id, MAX_TXS),
    };

    Ok(txs.iter().map(to_txs_reply).collect())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_txs(start_tx_id: u64, end_tx_id: u64) -> Result<String, String> {
    TX_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map
            .range(StableTxIdAlt(start_tx_id)..=StableTxIdAlt(end_tx_id))
            .map(|(k, _)| k)
            .collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive txs removed".to_string())
}

/// remove txs before the timestamp
#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_txs_by_ts(ts: u64) -> Result<String, String> {
    TX_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(_, tx)| tx.ts() < ts).map(|(tx_id, _)| tx_id).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive txs removed".to_string())
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_txs(tx_id: Option<u64>, num_txs: Option<u16>) -> Result<String, String> {
    TX_ARCHIVE_MAP.with(|m| {
        let map = m.borrow();
        let txs: BTreeMap<_, _> = match tx_id {
            Some(tx_id) => {
                let start_id = StableTxIdAlt(tx_id);
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

/*
#[update(hidden = true, guard = "caller_is_kingkong")]
fn upgrade_txs() -> Result<String, String> {
    TX_ALT_MAP.with(|m| {
        let tx_alt_map = m.borrow();
        TX_MAP.with(|m| {
            let mut tx_map = m.borrow_mut();
            tx_map.clear_new();
            for (k, v) in tx_alt_map.iter() {
                let tx_id = StableTxIdAlt::to_stable_tx_id(&k);
                let tx = StableTxAlt::to_stable_tx(&v);
                tx_map.insert(tx_id, tx);
            }
        });
    });

    Ok("Txs upgraded".to_string())
}
#[update(hidden = true, guard = "caller_is_kingkong")]
fn upgrade_alt_txs() -> Result<String, String> {
    TX_MAP.with(|m| {
        let tx_map = m.borrow();
        TX_ALT_MAP.with(|m| {
            let mut tx_alt_map = m.borrow_mut();
            tx_alt_map.clear_new();
            for (k, v) in tx_map.iter() {
                let tx_id = StableTxIdAlt::from_stable_tx_id(&k);
                let tx = StableTxAlt::from_stable_tx(&v);
                tx_alt_map.insert(tx_id, tx);
            }
        });
    });

    Ok("Alt txs upgraded".to_string())
}
*/
