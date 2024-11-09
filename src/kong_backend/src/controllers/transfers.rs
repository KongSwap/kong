use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::{TRANSFER_ARCHIVE_MAP, TRANSFER_MAP};
use crate::stable_transfer::stable_transfer::StableTransferId;
use crate::stable_transfer::transfer_map;
use crate::transfers::transfer_reply::TransferIdReply;
use crate::transfers::transfer_reply_impl::to_transfer_id;

const MAX_TRANSFERS: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_transfers(transfer_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    TRANSFER_MAP.with(|m| {
        let map = m.borrow();
        let transfers: BTreeMap<_, _> = match transfer_id {
            Some(transfer_id) => {
                let num_requests = num_requests.map_or(1, |n| n as usize);
                let start_key = StableTransferId(transfer_id);
                map.range(start_key..).take(num_requests).collect()
            }
            None => {
                let num_requests = num_requests.map_or(MAX_TRANSFERS, |n| n as usize);
                map.iter().take(num_requests).collect()
            }
        };

        serde_json::to_string(&transfers).map_err(|e| format!("Failed to serialize transfers: {}", e))
    })
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_transfers(transfer_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    TRANSFER_ARCHIVE_MAP.with(|m| {
        let map = m.borrow();
        let transfers: BTreeMap<_, _> = match transfer_id {
            Some(transfer_id) => {
                let num_requests = num_requests.map_or(1, |n| n as usize);
                let start_key = StableTransferId(transfer_id);
                map.range(start_key..).take(num_requests).collect()
            }
            None => {
                let num_requests = num_requests.map_or(MAX_TRANSFERS, |n| n as usize);
                map.iter().take(num_requests).collect()
            }
        };

        serde_json::to_string(&transfers).map_err(|e| format!("Failed to serialize transfers: {}", e))
    })
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn get_transfers(transfer_id: Option<u64>) -> Result<Vec<TransferIdReply>, String> {
    let transfers = match transfer_id {
        Some(transfer_id) => transfer_map::get_by_transfer_id(transfer_id).into_iter().collect(),
        None => transfer_map::get(MAX_TRANSFERS),
    };

    Ok(transfers.iter().filter_map(|v| to_transfer_id(v.transfer_id)).collect())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_transfers(start_transfer_id: u64, end_transfer_id: u64) -> Result<String, String> {
    TRANSFER_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map
            .iter()
            .filter(|(transfer_id, _)| transfer_id.0 >= start_transfer_id && transfer_id.0 <= end_transfer_id)
            .map(|(transfer_id, _)| transfer_id)
            .collect();
        keys_to_remove.iter().for_each(|transfer_id| {
            map.remove(transfer_id);
        });
    });

    Ok("transfers removed".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_transfers_by_ts(ts: u64) -> Result<String, String> {
    TRANSFER_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(_, v)| v.ts < ts).map(|(k, _)| k).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("transfers removed".to_string())
}
