use super::reply::Reply;
use super::request::Request;
use super::stable_request::StableRequest;

impl StableRequest {
    pub fn new(user_id: u32, request: &Request, ts: u64) -> Self {
        Self {
            request_id: 0,
            user_id,
            request: request.clone(),
            statuses: Vec::new(),
            reply: Reply::Pending,
            ts,
        }
    }
}
