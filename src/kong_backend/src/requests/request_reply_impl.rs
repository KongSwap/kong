use crate::stable_request::stable_request::StableRequest;

use super::request_reply::RequestReply;

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
