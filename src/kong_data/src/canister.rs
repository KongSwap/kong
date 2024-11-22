use ic_cdk::{init, post_upgrade, pre_upgrade, query};
use kong_lib::ic::logging::info_log;
use kong_lib::requests::request_reply::{to_request_reply, RequestReply};

use super::{APP_NAME, APP_VERSION};

use crate::ic::guards::caller_is_not_anonymous;
use crate::stable_request::request_map;
use crate::stable_user::user_map;

#[init]
async fn init() {
    info_log(&format!("{} canister has been initialized", APP_NAME));
}

#[pre_upgrade]
fn pre_upgrade() {
    info_log(&format!("{} canister is upgrading", APP_NAME));
}

#[post_upgrade]
async fn post_upgrade() {
    info_log(&format!("{} canister is upgraded", APP_NAME));
}

#[query]
fn icrc1_name() -> String {
    format!("{} {}", APP_NAME, APP_VERSION)
}

#[query(guard = "caller_is_not_anonymous")]
async fn requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<Vec<RequestReply>, String> {
    let user_id = match user_map::get_by_caller() {
        Ok(Some(caller)) => caller.user_id,
        Ok(None) | Err(_) => return Ok(Vec::new()),
    };
    let num_requests = num_requests.map(|n| n as usize);
    let requests = request_map::get_by_request_and_user_id(request_id, Some(user_id), num_requests)
        .iter()
        .map(to_request_reply)
        .collect();
    Ok(requests)
}

ic_cdk::export_candid!();
