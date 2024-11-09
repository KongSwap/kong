use ic_cdk::{query, update};
use kong_lib::stable_tx::stable_tx::{StableTx, StableTxId};
use std::collections::BTreeMap;

use super::guards::caller_is_kong_backend;
use super::stable_memory::TX_MAP;

const MAX_TXS: usize = 1_000;

//#[query(hidden = true, guard = "caller_is_kingkong")]
#[query(hidden = true)]
fn backup_txs(tx_id: Option<u64>, num_txs: Option<u16>) -> Result<String, String> {
    TX_MAP.with(|m| {
        let map = m.borrow();
        let txs: BTreeMap<_, _> = match tx_id {
            Some(tx_id) => {
                let num_txs = num_txs.map_or(1, |n| n as usize);
                let start_key = StableTxId(tx_id);
                map.range(start_key..).take(num_txs).collect()
            }
            None => {
                let num_txs = num_txs.map_or(MAX_TXS, |n| n as usize);
                map.iter().take(num_txs).collect()
            }
        };

        serde_json::to_string(&txs).map_err(|e| format!("Failed to serialize txs: {}", e))
    })
}

//#[update(guard = "caller_is_kong_backend")]
#[update(hidden = true)]
fn archive_txs(stable_txs_json: String) -> Result<String, String> {
    let txs: BTreeMap<StableTxId, StableTx> = match serde_json::from_str(&stable_txs_json) {
        Ok(txs) => txs,
        Err(e) => return Err(format!("Invalid txs: {}", e)),
    };

    TX_MAP.with(|tx_map| {
        let mut map = tx_map.borrow_mut();
        for (k, v) in txs.into_iter() {
            map.insert(k, v);
        }
    });

    Ok("Txs archived".to_string())
}
