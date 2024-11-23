use kong_lib::requests::request_reply::RequestReply;
use kong_lib::stable_request::stable_request::StableRequest;

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
