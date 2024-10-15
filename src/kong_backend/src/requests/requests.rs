use ic_cdk::query;

use super::request_reply::{to_request_reply, RequestReply};

use crate::canister::guards::not_in_maintenance_mode_and_caller_is_not_anonymous;
use crate::stable_request::request_map;
use crate::stable_user::user_map;

const MAX_REQUESTS: usize = 50;

#[query(guard = "not_in_maintenance_mode_and_caller_is_not_anonymous")]
pub async fn requests(request_id: Option<u64>) -> Result<Vec<RequestReply>, String> {
    let user_id = match user_map::get_by_caller() {
        Ok(Some(caller)) => caller.user_id,
        Ok(None) | Err(_) => return Ok(Vec::new()),
    };
    // will only return requests of the caller
    Ok(match request_id {
        Some(request_id) => request_map::get_by_request_and_user_id(request_id, Some(user_id))
            .iter()
            .map(to_request_reply)
            .collect(),
        None => request_map::get_by_user_id(Some(user_id), Some(MAX_REQUESTS))
            .iter()
            .map(to_request_reply)
            .collect(),
    })
}
