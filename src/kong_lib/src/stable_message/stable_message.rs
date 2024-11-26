use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableMessageId(pub u64);

impl Storable for StableMessageId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableMessage {
    pub message_id: u64, // unique id (same as StableMessageId) for MESSAGE_MAP
    pub to_user_id: u32, // user id of receiver
    pub title: String,   // title
    pub message: String, // message
    pub ts: u64,         // timestamp
}

impl StableMessage {
    pub fn new(to_user_id: u32, title: &str, message: &str, ts: u64) -> Self {
        Self {
            message_id: 0,
            to_user_id,
            title: title.to_string(),
            message: message.to_string(),
            ts,
        }
    }
}

impl Storable for StableMessage {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
