use candid::{CandidType, Deserialize};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq, Copy)]
pub enum TransactionNotificationStatus {
    Processed, // Transaction processed but not yet confirmed
    Confirmed, // Transaction confirmed on Solana
    Finalized, // Transaction finalized (highest confidence)
    Failed,    // Transaction failed
}

impl Storable for TransactionNotificationStatus {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        match self {
            TransactionNotificationStatus::Processed => Cow::Borrowed(&[0]),
            TransactionNotificationStatus::Confirmed => Cow::Borrowed(&[1]),
            TransactionNotificationStatus::Finalized => Cow::Borrowed(&[2]),
            TransactionNotificationStatus::Failed => Cow::Borrowed(&[3]),
        }
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match bytes.first() {
            Some(&0) => TransactionNotificationStatus::Processed,
            Some(&1) => TransactionNotificationStatus::Confirmed,
            Some(&2) => TransactionNotificationStatus::Finalized,
            Some(&3) => TransactionNotificationStatus::Failed,
            _ => panic!("Invalid TransactionNotificationStatus bytes"),
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1,
        is_fixed_size: true,
    };
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct TransactionNotificationId(pub String); // tx_signature

impl Storable for TransactionNotificationId {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        serde_cbor::to_vec(self).expect("Failed to encode TransactionNotificationId").into()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("Failed to decode TransactionNotificationId")
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(Debug, CandidType, Deserialize, Serialize, Clone)]
pub struct TransactionNotification {
    pub status: TransactionNotificationStatus,
    pub metadata: Option<String>, // Store full RPC response or parsed details
    pub timestamp: u64,
    pub tx_signature: String,
    pub job_id: u64,
    pub is_completed: bool,
}

impl Storable for TransactionNotification {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        serde_cbor::to_vec(self).expect("Failed to encode TransactionNotification").into()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("Failed to decode TransactionNotification")
    }

    const BOUND: Bound = Bound::Unbounded;
}
