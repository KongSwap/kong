use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::stable_message::{StableMessage, StableMessageId};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableMessageIdAlt(pub u64);

impl StableMessageIdAlt {
    pub fn from_stable_message_id(stable_message_id: &StableMessageId) -> Self {
        let message_id_alt = serde_json::to_value(stable_message_id).unwrap();
        serde_json::from_value(message_id_alt).unwrap()
    }

    pub fn to_stable_message_id(&self) -> StableMessageId {
        let message_id_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(message_id_alt).unwrap()
    }
}

impl Storable for StableMessageIdAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableMessageAlt {
    pub message_id: u64, // unique id (same as StableMessageId) for MESSAGE_MAP
    pub to_user_id: u32, // user id of receiver
    pub title: String,   // title
    pub message: String, // message
    pub ts: u64,         // timestamp
}

impl StableMessageAlt {
    pub fn from_stable_message(stable_message: &StableMessage) -> Self {
        let message_alt = serde_json::to_value(stable_message).unwrap();
        serde_json::from_value(message_alt).unwrap()
    }

    pub fn to_stable_message(&self) -> StableMessage {
        let message_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(message_alt).unwrap()
    }
}

impl Storable for StableMessageAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
