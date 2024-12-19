use ic_cdk::query;

use super::request_reply::RequestReply;
use super::request_reply_helpers::to_request_reply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_request::request_map;

#[query(guard = "not_in_maintenance_mode")]
async fn requests(request_id: Option<u64>) -> Result<Vec<RequestReply>, String> {
    let requests = request_map::get_by_request_and_user_id(request_id, None, None)
        .iter()
        .map(to_request_reply)
        .collect();
    Ok(requests)
}
