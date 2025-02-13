use ic_cdk::query;

use super::request_reply::RequestReply;
use super::request_reply_helpers::to_request_reply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_request::request_map;

#[query(guard = "not_in_maintenance_mode")]
async fn requests(request_id: Option<u64>) -> Result<Vec<RequestReply>, String> {
    if ic_cdk::api::data_certificate().is_none() {
        return Err("swap_amount cannot be called in replicated mode".to_string());
    }

    let request_id = match request_id {
        Some(request_id) => request_id,
        None => Err("request_id is required".to_string())?,
    };

    let requests = request_map::get_by_request_id(request_id).iter().map(to_request_reply).collect();

    Ok(requests)
}
