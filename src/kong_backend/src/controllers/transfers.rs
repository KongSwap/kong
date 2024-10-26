use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::TRANSFER_MAP;
use crate::stable_transfer::stable_transfer::StableTransferId;
use crate::stable_transfer::transfer_map;
use crate::transfers::transfer_reply::TransferIdReply;
use crate::transfers::transfer_reply_impl::to_transfer_id;

const MAX_TRANSFERS: usize = 100;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_transfers(transfer_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    let num_requests = num_requests.map_or(1, |n| n as usize);
    match transfer_id {
        Some(transfer_id) if num_requests == 1 => TRANSFER_MAP.with(|m| {
            let key = StableTransferId(transfer_id);
            serde_json::to_string(&m.borrow().get(&key).map_or_else(
                || Err(format!("Transfer #{} not found", transfer_id)),
                |v| Ok(BTreeMap::new().insert(key, v)),
            ))
            .map_err(|e| format!("Failed to serialize transfers: {}", e))
        }),
        Some(transfer_id) => TRANSFER_MAP.with(|m| {
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .collect::<BTreeMap<_, _>>()
                    .range(StableTransferId(transfer_id)..)
                    .take(num_requests)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize transfers: {}", e))
        }),
        None => TRANSFER_MAP.with(|m| {
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .take(num_requests)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize transfers: {}", e))
        }),
    }
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn get_transfers(transfer_id: Option<u64>) -> Result<Vec<TransferIdReply>, String> {
    Ok(match transfer_id {
        Some(transfer_id) => transfer_map::get_by_transfer_id(transfer_id)
            .iter()
            .filter_map(|v| to_transfer_id(v.transfer_id))
            .collect(),
        None => transfer_map::get(MAX_TRANSFERS)
            .iter()
            .filter_map(|v| to_transfer_id(v.transfer_id))
            .collect(),
    })
}
