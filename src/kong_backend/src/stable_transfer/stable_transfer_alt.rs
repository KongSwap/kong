use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::stable_transfer::{StableTransfer, StableTransferId};
use super::tx_id::TxId;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableTransferIdAlt(pub u64);

impl StableTransferIdAlt {
    pub fn from_stable_transfer_id(stable_transfer_id: &StableTransferId) -> Self {
        let transfer_id_alt = serde_json::to_value(stable_transfer_id).unwrap();
        serde_json::from_value(transfer_id_alt).unwrap()
    }

    pub fn to_stable_transfer_id(&self) -> StableTransferId {
        let transfer_id_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(transfer_id_alt).unwrap()
    }
}

impl Storable for StableTransferIdAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableTransferAlt {
    pub transfer_id: u64,
    pub request_id: u64,
    pub is_send: bool, // from user's perspective. so if is_send is true, it means the user is sending the token
    pub amount: Nat,
    pub token_id: u32,
    pub tx_id: TxId,
    pub ts: u64,
}

impl StableTransferAlt {
    pub fn from_stable_transfer(stable_transfer: &StableTransfer) -> Self {
        let transfer_alt = serde_json::to_value(stable_transfer).unwrap();
        serde_json::from_value(transfer_alt).unwrap()
    }

    pub fn to_stable_transfer(&self) -> StableTransfer {
        let transfer_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(transfer_alt).unwrap()
    }
}

impl Storable for StableTransferAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
