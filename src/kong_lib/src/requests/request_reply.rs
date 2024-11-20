use crate::stable_request::reply::Reply;
use crate::stable_request::request::Request;
use crate::stable_request::stable_request::StableRequest;
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

// creates a RequestReply from a StableRequest
pub fn to_request_reply(request: &StableRequest) -> RequestReply {
    // convert all statuses to string
    let statuses: Vec<String> = request.statuses.iter().map(|status| status.to_string()).collect();
    RequestReply {
        request_id: request.request_id,
        statuses,
        request: request.request.clone(),
        reply: request.reply.clone(),
        ts: request.ts,
    }
}
