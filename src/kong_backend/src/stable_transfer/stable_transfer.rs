use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::stable_transfer_old::{StableTransferIdOld, StableTransferOld};
use super::tx_id::TxId;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableTransferId(pub u64);

impl StableTransferId {
    pub fn from_old(stable_transfer_id: &StableTransferIdOld) -> Self {
        let transfer_id_old = serde_json::to_value(stable_transfer_id).unwrap();
        serde_json::from_value(transfer_id_old).unwrap()
    }
}

impl Storable for StableTransferId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
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

impl StableTransfer {
    pub fn from_old(stable_transfer: &StableTransferOld) -> Self {
        let transfer_old = serde_json::to_value(stable_transfer).unwrap();
        serde_json::from_value(transfer_old).unwrap()
    }
}

impl Storable for StableTransfer {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
