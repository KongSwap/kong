use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::requests::request_reply::RequestReply;
use crate::requests::request_reply_impl::to_request_reply;
use crate::stable_memory::REQUEST_MAP;
use crate::stable_request::request_map;
use crate::stable_request::stable_request::StableRequestId;

const MAX_REQUESTS: usize = 100;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    let num_requests = num_requests.map_or(1, |n| n as usize);
    match request_id {
        // return a single request
        Some(request_id) if num_requests == 1 => REQUEST_MAP.with(|m| {
            let key = StableRequestId(request_id);
            serde_json::to_string(&m.borrow().get(&key).map_or_else(
                || Err(format!("Request #{} not found", request_id)),
                |v| Ok(BTreeMap::new().insert(key, v)),
            ))
            .map_err(|e| format!("Failed to serialize requests: {}", e))
        }),
        // return a range of requests in reverse order
        Some(request_id) => REQUEST_MAP.with(|m| {
            let start_key = StableRequestId(request_id);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .collect::<BTreeMap<_, _>>()
                    .range(start_key..)
                    .take(num_requests)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize requests: {}", e))
        }),
        // return the latest requests
        None => REQUEST_MAP.with(|m| {
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .take(num_requests)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize requests: {}", e))
        }),
    }
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn get_requests(request_id: Option<u64>, user_id: Option<u32>) -> Result<Vec<RequestReply>, String> {
    Ok(match request_id {
        Some(request_id) => request_map::get_by_request_and_user_id(request_id, user_id)
            .iter()
            .map(to_request_reply)
            .collect(),
        None => request_map::get_by_user_id(user_id, MAX_REQUESTS)
            .iter()
            .map(to_request_reply)
            .collect(),
    })
}
