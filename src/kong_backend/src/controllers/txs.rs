use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::TX_MAP;
use crate::stable_tx::tx_map;
use crate::txs::txs_reply::TxsReply;
use crate::txs::txs_reply_impl::to_txs_reply;

const MAX_TXS: usize = 100;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_txs(tx_id: Option<u64>) -> Result<String, String> {
    match tx_id {
        Some(tx_id) => TX_MAP.with(|m| {
            m.borrow().iter().find(|(k, _)| k.0 == tx_id).map_or_else(
                || Err(format!("Tx #{} not found", tx_id)),
                |(k, v)| serde_json::to_string(&(k, v)).map_err(|e| format!("Failed to serialize tx: {}", e)),
            )
        }),
        None => {
            let txs: BTreeMap<_, _> = TX_MAP.with(|m| m.borrow().iter().collect());
            serde_json::to_string(&txs).map_err(|e| format!("Failed to serialize txs: {}", e))
        }
    }
}

#[query(hidden = true, guard = "caller_is_kingkong")]
pub fn get_txs(tx_id: Option<u64>, user_id: Option<u32>, token_id: Option<u32>) -> Result<Vec<TxsReply>, String> {
    if let Some(tx_id) = tx_id {
        return Ok(TX_MAP.with(|m| {
            m.borrow()
                .iter()
                .find_map(|(k, v)| if k.0 == tx_id { Some(v) } else { None })
                .iter()
                .map(to_txs_reply)
                .collect::<Vec<TxsReply>>()
        }));
    }

    // get all txs filtered by user_id and token_id
    let txs = tx_map::get_by_user_and_token_id(user_id, token_id, Some(MAX_TXS));
    Ok(txs.iter().map(to_txs_reply).collect::<Vec<TxsReply>>())
}
