use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::tx_id::TxId;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableTransferId(pub u64);

const TRANSFER_ID_SIZE: u32 = std::mem::size_of::<u64>() as u32;

impl Storable for StableTransferId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.to_bytes() // u64 is already Storable
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(u64::from_bytes(bytes))
    }

    // u64 is fixed size
    const BOUND: Bound = Bound::Bounded {
        max_size: TRANSFER_ID_SIZE,
        is_fixed_size: true,
    };
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
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    // unbounded size
    const BOUND: Bound = Bound::Unbounded;
}
