use ic_cdk::{query, update};
use std::cmp::max;
use std::collections::BTreeMap;

use crate::ic::get_time::get_time;
use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::{REQUEST_ARCHIVE_MAP, REQUEST_MAP};
use crate::stable_request::request_archive::archive_request_map;
use crate::stable_request::stable_request::{StableRequest, StableRequestId};

const MAX_REQUESTS: usize = 1000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn max_request_idx() -> u64 {
    REQUEST_MAP.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.0))
}

/// serialize REQUEST_ARCHIVE_MAP for backup
/// used for storing backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    REQUEST_ARCHIVE_MAP.with(|m| {
        let map = m.borrow();
        let requests: BTreeMap<_, _> = match request_id {
            Some(request_id) => {
                let start_id = StableRequestId(request_id);
                let num_requests = num_requests.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_requests).collect()
            }
            None => {
                let num_requests = num_requests.map_or(MAX_REQUESTS, |n| n as usize);
                map.iter().take(num_requests).collect()
            }
        };
        serde_json::to_string(&requests).map_err(|e| format!("Failed to serialize requests: {}", e))
    })
}

/// deserialize StableRequest and update REQUEST_MAP
/// used for restoring from backup
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_requests(stable_requests_json: String) -> Result<String, String> {
    let requests: BTreeMap<StableRequestId, StableRequest> = match serde_json::from_str(&stable_requests_json) {
        Ok(requests) => requests,
        Err(e) => return Err(format!("Invalid requests: {}", e)),
    };

    REQUEST_MAP.with(|request_map| {
        let mut map = request_map.borrow_mut();
        for (k, v) in requests {
            map.insert(k, v);
        }
    });

    Ok("Requests updated".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn archive_requests() -> Result<String, String> {
    archive_request_map();

    Ok("Requests archived".to_string())
}

/// remove archive requests older than ts
#[update(hidden = true, guard = "caller_is_kingkong")]
fn archive_requests_num() -> Result<String, String> {
    REQUEST_MAP.with(|request_map| {
        REQUEST_ARCHIVE_MAP.with(|request_archive_map| {
            let request = request_map.borrow();
            let mut request_archive = request_archive_map.borrow_mut();
            let start_request_id = max(
                request.first_key_value().map_or(0_u64, |(k, _)| k.0),
                request_archive.last_key_value().map_or(0_u64, |(k, _)| k.0),
            );
            let end_request_id = start_request_id + MAX_REQUESTS as u64;
            for request_id in start_request_id..=end_request_id {
                if let Some(request) = request.get(&StableRequestId(request_id)) {
                    request_archive.insert(StableRequestId(request_id), request);
                }
            }
        });
    });

    Ok("Requests archived num".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_requests() -> Result<String, String> {
    // only keep requests from the last hour
    let one_hour_ago = get_time() - 3_600_000_000_000;
    let mut remove_list = Vec::new();
    REQUEST_MAP.with(|request_map| {
        request_map.borrow().iter().for_each(|(request_id, request)| {
            if request.ts < one_hour_ago {
                remove_list.push(request_id);
            }
        });
    });
    REQUEST_MAP.with(|request_map| {
        remove_list.iter().for_each(|request_id| {
            request_map.borrow_mut().remove(request_id);
        });
    });

    Ok("Requests removed".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_requests(ts: u64) -> Result<String, String> {
    REQUEST_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(_, v)| v.ts < ts).map(|(k, _)| k).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive requests removed".to_string())
}

/// remove archive requests where request_id <= request_ids
#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_request_ids(request_ids: u64) -> Result<String, String> {
    REQUEST_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(k, _)| k.0 <= request_ids).map(|(k, _)| k).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive requests removed".to_string())
}
