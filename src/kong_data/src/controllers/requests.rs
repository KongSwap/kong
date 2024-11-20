use ic_cdk::{query, update};
use kong_lib::requests::request_reply::{to_request_reply, RequestReply};
use kong_lib::stable_request::stable_request::{StableRequest, StableRequestId};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::requests::request_map;
use crate::stable_memory::REQUEST_MAP;

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
