use crate::stable_request::reply::Reply;
use crate::stable_request::request::Request;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct RequestReply {
    pub request_id: u64,
    pub statuses: Vec<String>,
    pub request: Request,
    pub reply: Reply,
    pub ts: u64,
}
