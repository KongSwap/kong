use candid::{CandidType, Deserialize};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

/// Struct to store the latest blockhash and its timestamp (ic-time, in nanoseconds)
#[derive(CandidType, Deserialize, Serialize, Clone, Debug, Default)]
pub struct LatestBlockhash {
    pub blockhash: String,
    pub timestamp_nanos: u64,
}

impl Storable for LatestBlockhash {
    fn to_bytes(&self) -> Cow<[u8]> {
        serde_cbor::to_vec(self).expect("Failed to encode LatestBlockhash").into()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("Failed to decode LatestBlockhash")
    }

    const BOUND: Bound = Bound::Unbounded;
}
