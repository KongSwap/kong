use ic_cdk::query;
use kong_lib::requests::request_reply::{to_request_reply, RequestReply};

use super::request_map;

use crate::ic::guards::caller_is_not_anonymous;
use crate::stable_user::user_map;

const MAX_REQUESTS: usize = 100;

#[query(guard = "caller_is_not_anonymous")]
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
        None => request_map::get_by_user_id(Some(user_id), MAX_REQUESTS)
            .iter()
            .map(to_request_reply)
            .collect(),
    })
}
