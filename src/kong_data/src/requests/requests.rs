use ic_cdk::query;

use super::request_reply::RequestReply;
use super::request_reply_helpers::to_request_reply;

use crate::stable_request::request_map;

#[query]
async fn requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<Vec<RequestReply>, String> {
    let num_requests = num_requests.map(|n| n as usize);
    let requests = request_map::get_by_request_and_user_id(request_id, None, num_requests)
        .iter()
        .map(to_request_reply)
        .collect();
    Ok(requests)
}
