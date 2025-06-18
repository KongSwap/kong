use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::tx_id::TxId;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableTransferId(pub u64);

impl Storable for StableTransferId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).expect("Failed to encode StableTransferId").into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("Failed to decode StableTransferId")
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableTransfer {
    pub transfer_id: u64,
    pub request_id: u64,
    pub is_send: bool, // from user's perspective. so if is_send is true, it means the user is sending the token
    pub amount: Nat,
    pub token_id: u32,
    pub tx_id: TxId,
    pub ts: u64,
}

impl Storable for StableTransfer {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).expect("Failed to encode StableTransfer").into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("Failed to decode StableTransfer")
    }

    const BOUND: Bound = Bound::Unbounded;
}
