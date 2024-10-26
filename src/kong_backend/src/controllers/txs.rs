use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::TX_MAP;
use crate::stable_tx::stable_tx::StableTxId;
use crate::stable_tx::tx_map;
use crate::txs::txs_reply::TxsReply;
use crate::txs::txs_reply_impl::to_txs_reply;

const MAX_TXS: usize = 100;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_txs(tx_id: Option<u64>, num_txs: Option<u16>) -> Result<String, String> {
    let num_txs = num_txs.map_or(1, |n| n as usize);
    match tx_id {
        Some(tx_id) if num_txs == 1 => TX_MAP.with(|m| {
            let key = StableTxId(tx_id);
            serde_json::to_string(
                &m.borrow()
                    .get(&key)
                    .map_or_else(|| Err(format!("Tx #{} not found", tx_id)), |v| Ok(BTreeMap::new().insert(key, v)))?,
            )
            .map_err(|e| format!("Failed to serialize txs: {}", e))
        }),
        Some(tx_id) => TX_MAP.with(|m| {
            let start_key = StableTxId(tx_id);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .collect::<BTreeMap<_, _>>()
                    .range(start_key..)
                    .take(num_txs)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize txs: {}", e))
        }),
        None => TX_MAP.with(|m| {
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .take(num_txs)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize txs: {}", e))
        }),
    }
}

#[query(hidden = true, guard = "caller_is_kingkong")]
pub fn get_txs(tx_id: Option<u64>, user_id: Option<u32>, token_id: Option<u32>) -> Result<Vec<TxsReply>, String> {
    Ok(match tx_id {
        Some(tx_id) => tx_map::get_by_tx_and_user_id(tx_id, user_id).iter().map(to_txs_reply).collect(),
        None => tx_map::get_by_user_and_token_id(user_id, token_id, MAX_TXS)
            .iter()
            .map(to_txs_reply)
            .collect(),
    })
}
