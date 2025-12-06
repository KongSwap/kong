use candid::CandidType;
use serde::{Deserialize, Serialize};

use kong_lib::stable_request::reply::Reply;
use kong_lib::stable_request::request::Request;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct RequestReply {
    pub request_id: u64,
    pub statuses: Vec<String>,
    pub request: Request,
    pub reply: Reply,
    pub ts: u64,
}
