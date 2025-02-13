use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::{TRANSFER_ARCHIVE_MAP, TRANSFER_MAP};
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};

const MAX_TRANSFERS: usize = 100;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn max_transfer_idx() -> u64 {
    TRANSFER_MAP.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.0))
}

/// serialize TRANSFER_ARCHIVE_MAP for backup
/// used for storing backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_transfers(transfer_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    TRANSFER_ARCHIVE_MAP.with(|m| {
        let map = m.borrow();
        let transfers: BTreeMap<_, _> = match transfer_id {
            Some(transfer_id) => {
                let start_id = StableTransferId(transfer_id);
                let num_requests = num_requests.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_requests).collect()
            }
            None => {
                let num_requests = num_requests.map_or(MAX_TRANSFERS, |n| n as usize);
                map.iter().take(num_requests).collect()
            }
        };
        serde_json::to_string(&transfers).map_err(|e| format!("Failed to serialize transfers: {}", e))
    })
}

/// deserialize StableTransfer and update TRANSFER_MAP
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_transfers(stable_transfers_json: String) -> Result<String, String> {
    let transfers: BTreeMap<StableTransferId, StableTransfer> = match serde_json::from_str(&stable_transfers_json) {
        Ok(transfers) => transfers,
        Err(e) => return Err(format!("Invalid transfers: {}", e)),
    };

    TRANSFER_MAP.with(|transfer_map| {
        let mut map = transfer_map.borrow_mut();
        for (k, v) in transfers {
            map.insert(k, v);
        }
    });

    Ok("Transfers updated".to_string())
}

/// remove archive transfers older than ts
#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_transfers(ts: u64) -> Result<String, String> {
    TRANSFER_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(_, v)| v.ts < ts).map(|(k, _)| k).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive transfers removed".to_string())
}

/// remove archive transfers where transfer_id <= transfer_ids
#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_transfers_ids(transfer_ids: u64) -> Result<String, String> {
    TRANSFER_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(k, _)| k.0 <= transfer_ids).map(|(k, _)| k).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive transfers removed".to_string())
}
