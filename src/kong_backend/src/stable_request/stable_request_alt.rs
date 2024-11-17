use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::reply::Reply;
use super::request::Request;
use super::stable_request::{StableRequest, StableRequestId};
use super::status::Status;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableRequestIdAlt(pub u64);

impl StableRequestIdAlt {
    pub fn from_stable_request_id(stable_request_id: &StableRequestId) -> Self {
        let request_id_alt = serde_json::to_value(stable_request_id).unwrap();
        serde_json::from_value(request_id_alt).unwrap()
    }
}

impl Storable for StableRequestIdAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableRequestAlt {
    pub request_id: u64,
    pub user_id: u32,
    pub request: Request,
    pub statuses: Vec<Status>,
    pub reply: Reply,
    pub ts: u64,
}

impl StableRequestAlt {
    pub fn from_stable_request(stable_request: &StableRequest) -> Self {
        let request_alt = serde_json::to_value(stable_request).unwrap();
        serde_json::from_value(request_alt).unwrap()
    }
}

impl Storable for StableRequestAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
