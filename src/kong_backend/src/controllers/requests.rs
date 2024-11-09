use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::requests::request_reply::RequestReply;
use crate::requests::request_reply_impl::to_request_reply;
use crate::stable_memory::{REQUEST_ARCHIVE_MAP, REQUEST_MAP};
use crate::stable_request::request_map;
use crate::stable_request::stable_request::StableRequestId;

const MAX_REQUESTS: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    REQUEST_MAP.with(|m| {
        let map = m.borrow();
        let requests: BTreeMap<_, _> = match request_id {
            Some(request_id) => {
                let num_requests = num_requests.map_or(1, |n| n as usize);
                let start_key = StableRequestId(request_id);
                map.range(start_key..).take(num_requests).collect()
            }
            None => {
                let num_requests = num_requests.map_or(MAX_REQUESTS, |n| n as usize);
                map.iter().take(num_requests).collect()
            }
        };

        serde_json::to_string(&requests).map_err(|e| format!("Failed to serialize requests: {}", e))
    })
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    REQUEST_ARCHIVE_MAP.with(|m| {
        let map = m.borrow();
        let requests: BTreeMap<_, _> = match request_id {
            Some(request_id) => {
                let num_requests = num_requests.map_or(1, |n| n as usize);
                let start_key = StableRequestId(request_id);
                map.range(start_key..).take(num_requests).collect()
            }
            None => {
                let num_requests = num_requests.map_or(MAX_REQUESTS, |n| n as usize);
                map.iter().take(num_requests).collect()
            }
        };

        serde_json::to_string(&requests).map_err(|e| format!("Failed to serialize requests: {}", e))
    })
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
fn remove_archive_requests_by_ts(ts: u64) -> Result<String, String> {
    REQUEST_ARCHIVE_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let keys_to_remove: Vec<_> = map.iter().filter(|(_, v)| v.ts < ts).map(|(k, _)| k).collect();
        keys_to_remove.iter().for_each(|k| {
            map.remove(k);
        });
    });

    Ok("requests removed".to_string())
}
