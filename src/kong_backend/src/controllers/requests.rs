use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::requests::request_reply::RequestReply;
use crate::requests::request_reply_impl::to_request_reply;
use crate::stable_memory::{REQUEST_ARCHIVE_MAP, REQUEST_ARCHIVE_OLD_MAP, REQUEST_MAP};
use crate::stable_request::request_map;
use crate::stable_request::stable_request::{StableRequest, StableRequestId};
use crate::stable_request::stable_request_alt::{StableRequestAlt, StableRequestIdAlt};

const MAX_REQUESTS: usize = 1_000;

/// serialize REQUEST_MAP for backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    REQUEST_MAP.with(|m| {
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

/// deserialize REQUEST_MAP and update stable memory
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

#[query(hidden = true, guard = "caller_is_kingkong")]
fn get_requests(request_id: Option<u64>, user_id: Option<u32>) -> Result<Vec<RequestReply>, String> {
    let requests = match request_id {
        Some(request_id) => request_map::get_by_request_and_user_id(request_id, user_id).into_iter().collect(),
        None => request_map::get_by_user_id(user_id, MAX_REQUESTS),
    };

    Ok(requests.iter().map(to_request_reply).collect())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_requests(start_request_id: u64, end_request_id: u64) -> Result<String, String> {
    REQUEST_ARCHIVE_OLD_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map
            .range(StableRequestId(start_request_id)..=StableRequestId(end_request_id))
            .map(|(k, _)| k)
            .collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive requests removed".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_archive_requests_by_ts(ts: u64) -> Result<String, String> {
    REQUEST_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(_, v)| v.ts < ts).map(|(k, _)| k).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("Archive requests removed".to_string())
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    REQUEST_ARCHIVE_MAP.with(|m| {
        let map = m.borrow();
        let requests: BTreeMap<_, _> = match request_id {
            Some(request_id) => {
                let start_id = StableRequestIdAlt(request_id);
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

/*
#[update(hidden = true, guard = "caller_is_kingkong")]
fn upgrade_requests() -> Result<String, String> {
    REQUEST_ALT_MAP.with(|m| {
        let request_alt_map = m.borrow();
        REQUEST_MAP.with(|m| {
            let mut request_map = m.borrow_mut();
            request_map.clear_new();
            for (k, v) in request_alt_map.iter() {
                let request_id = StableRequestIdAlt::to_stable_request_id(&k);
                let request = StableRequestAlt::to_stable_request(&v);
                request_map.insert(request_id, request);
            }
        });
    });

    Ok("Requests upgraded".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn upgrade_alt_requests() -> Result<String, String> {
    REQUEST_MAP.with(|m| {
        let request_map = m.borrow();
        REQUEST_ALT_MAP.with(|m| {
            let mut request_alt_map = m.borrow_mut();
            request_alt_map.clear_new();
            for (k, v) in request_map.iter() {
                let request_id = StableRequestIdAlt::from_stable_request_id(&k);
                let request = StableRequestAlt::from_stable_request(&v);
                request_alt_map.insert(request_id, request);
            }
        });
    });

    Ok("Alt requests upgraded".to_string())
}
*/

#[update(hidden = true, guard = "caller_is_kingkong")]
fn upgrade_archive_requests() -> Result<String, String> {
    REQUEST_ARCHIVE_OLD_MAP.with(|m| {
        let request_archive_old_map = m.borrow();
        REQUEST_ARCHIVE_MAP.with(|m| {
            let mut request_map = m.borrow_mut();
            request_map.clear_new();
            for (k, v) in request_archive_old_map.iter() {
                let request_id = StableRequestIdAlt::from_stable_request_id(&k);
                let request = StableRequestAlt::from_stable_request(&v);
                request_map.insert(request_id, request);
            }
        });
    });

    Ok("Archive requests upgraded".to_string())
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_old_requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    REQUEST_ARCHIVE_OLD_MAP.with(|m| {
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
