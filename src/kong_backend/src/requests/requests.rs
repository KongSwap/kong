use ic_cdk::query;

use super::request_reply::RequestReply;
use super::request_reply_helpers::to_request_reply;

use crate::ic::guards::not_in_maintenance_mode_and_caller_is_not_anonymous;
use crate::stable_request::request_map;
use crate::stable_user::user_map;

#[query(guard = "not_in_maintenance_mode_and_caller_is_not_anonymous")]
async fn requests(request_id: Option<u64>) -> Result<Vec<RequestReply>, String> {
    let user_id = match user_map::get_by_caller() {
        Ok(Some(caller)) => caller.user_id,
        Ok(None) | Err(_) => return Ok(Vec::new()),
    };
    let requests = request_map::get_by_request_and_user_id(request_id, Some(user_id), None)
        .iter()
        .map(to_request_reply)
        .collect();
    Ok(requests)
}
