use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::reply::Reply;
use super::request::Request;
use super::status::Status;

const REQUEST_ID_SIZE: u32 = std::mem::size_of::<u64>() as u32;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableRequestId(pub u64);

impl Storable for StableRequestId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.to_bytes() // u64 is already Storable
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(u64::from_bytes(bytes))
    }

    // u64 is fixed size
    const BOUND: Bound = Bound::Bounded {
        max_size: REQUEST_ID_SIZE,
        is_fixed_size: true,
    };
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

impl Storable for StableRequest {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    // unbounded size
    const BOUND: Bound = Bound::Unbounded;
}
