use ic_cdk::query;
use std::cmp::Reverse;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::TRANSFER_MAP;
use crate::stable_transfer::stable_transfer::StableTransfer;
use crate::transfers::transfer_reply::TransferIdReply;
use crate::transfers::transfer_reply_impl::to_transfer_id;

const MAX_TRANSFERS: usize = 100;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_transfers(transfer_id: Option<u64>) -> Result<String, String> {
    match transfer_id {
        Some(transfer_id) => TRANSFER_MAP.with(|m| {
            m.borrow().iter().find(|(k, _)| k.0 == transfer_id).map_or_else(
                || Err(format!("Transfer #{} not found", transfer_id)),
                |(k, v)| serde_json::to_string(&(k, v)).map_err(|e| format!("Failed to serialize transfer: {}", e)),
            )
        }),
        None => {
            let transfers: BTreeMap<_, _> = TRANSFER_MAP.with(|m| m.borrow().iter().collect());
            serde_json::to_string(&transfers).map_err(|e| format!("Failed to serialize transfers: {}", e))
        }
    }
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn get_transfers(transfer_id: Option<u64>) -> Result<Vec<TransferIdReply>, String> {
    match transfer_id {
        Some(transfer_id) => Ok(TRANSFER_MAP.with(|m| {
            m.borrow()
                .iter()
                .filter_map(|(k, v)| if k.0 == transfer_id { to_transfer_id(v.transfer_id) } else { None })
                .collect::<Vec<TransferIdReply>>()
        })),
        None => {
            let mut transfers = TRANSFER_MAP.with(|m| m.borrow().iter().map(|(_, v)| v).collect::<Vec<StableTransfer>>());
            // order by timestamp in reverse order
            transfers.sort_by_key(|transfer| Reverse(transfer.ts));
            transfers.truncate(MAX_TRANSFERS);
            Ok(transfers
                .iter()
                .filter_map(|transfer| to_transfer_id(transfer.transfer_id))
                .collect::<Vec<TransferIdReply>>())
        }
    }
}
