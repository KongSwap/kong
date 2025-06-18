use candid::{CandidType, Deserialize};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct TransactionNotification {
    pub signature: String,
    pub status: String, // e.g., "processed", "confirmed", "finalized", "failed"
    pub metadata: Option<String>, // Store full RPC response or parsed details
    pub timestamp: u64,
}

impl Storable for TransactionNotification {
    fn to_bytes(&self) -> Cow<[u8]> {
        let bytes = candid::encode_one(self).expect("Failed to encode TransactionNotification");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).expect("Failed to decode TransactionNotification")
    }

    const BOUND: Bound = Bound::Unbounded;
}

/// Key for transaction notification storage
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct TransactionNotificationId(pub String); // signature

impl Storable for TransactionNotificationId {
    fn to_bytes(&self) -> Cow<[u8]> {
        self.0.to_bytes()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(String::from_bytes(bytes))
    }

    const BOUND: Bound = Bound::Unbounded;
}