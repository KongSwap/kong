use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::requests::request_reply::RequestReply;
use crate::requests::request_reply_impl::to_request_reply;
use crate::stable_memory::REQUEST_MAP;
use crate::stable_request::request_map;

const MAX_REQUESTS: usize = 100;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_requests(request_id: Option<u64>) -> Result<String, String> {
    match request_id {
        Some(request_id) => REQUEST_MAP.with(|m| {
            m.borrow().iter().find(|(k, _)| k.0 == request_id).map_or_else(
                || Err(format!("Request #{} not found", request_id)),
                |(k, v)| serde_json::to_string(&(k, v)).map_err(|e| format!("Failed to serialize request: {}", e)),
            )
        }),
        None => {
            let requests: BTreeMap<_, _> = REQUEST_MAP.with(|m| m.borrow().iter().collect());
            serde_json::to_string(&requests).map_err(|e| format!("Failed to serialize requests: {}", e))
        }
    }
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn get_requests(request_id: Option<u64>, user_id: Option<u32>) -> Result<Vec<RequestReply>, String> {
    if let Some(request_id) = request_id {
        return Ok(request_map::get_by_request_and_user_id(request_id, user_id)
            .iter()
            .map(to_request_reply)
            .collect::<Vec<RequestReply>>());
    }

    // get all requests
    let requests = request_map::get_by_user_id(user_id, Some(MAX_REQUESTS));
    Ok(requests.iter().map(to_request_reply).collect::<Vec<RequestReply>>())
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn get_requests_id(start_request_id: u64, end_reqeust_id: u64) -> Result<Vec<RequestReply>, String> {
    Err("Not implemented".to_string())
}
