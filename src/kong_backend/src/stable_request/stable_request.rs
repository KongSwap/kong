use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::reply::Reply;
use super::request::Request;
use super::status::Status;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableRequestId(pub u64);

impl Storable for StableRequestId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableRequest {
    pub request_id: u64,
    pub user_id: u32,
    pub request: Request,
    pub statuses: Vec<Status>,
    pub reply: Reply,
    pub ts: u64,
}

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

impl Storable for StableRequest {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
