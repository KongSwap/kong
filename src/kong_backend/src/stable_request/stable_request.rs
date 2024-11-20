use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::reply::Reply;
use super::request::Request;
use super::stable_request_old::{StableRequestIdOld, StableRequestOld};
use super::status::Status;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableRequestId(pub u64);

impl StableRequestId {
    pub fn from_old(stable_request_id: &StableRequestIdOld) -> Self {
        let request_id_old = serde_json::to_value(stable_request_id).unwrap();
        serde_json::from_value(request_id_old).unwrap()
    }
}

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
    pub fn from_old(stable_request: &StableRequestOld) -> Self {
        let request_old = serde_json::to_value(stable_request).unwrap();
        serde_json::from_value(request_old).unwrap()
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
