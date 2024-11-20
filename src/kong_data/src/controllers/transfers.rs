use ic_cdk::query;
use kong_lib::stable_transfer::stable_transfer::StableTransferId;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::TRANSFER_MAP;

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
