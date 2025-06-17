use candid::{CandidType, Deserialize};
use ic_stable_structures::{storable::Bound, Storable};
use std::borrow::Cow;

/// Struct to store the latest blockhash and its timestamp (ic-time, in nanoseconds)
#[derive(CandidType, Deserialize, Clone, Debug, Default)]
pub struct LatestBlockhash {
    pub blockhash: String,
    pub timestamp_nanos: u64,
}

impl Storable for LatestBlockhash {
    fn to_bytes(&self) -> Cow<[u8]> {
        let bytes = candid::encode_one(self).expect("Failed to encode LatestBlockhash");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).expect("Failed to decode LatestBlockhash")
    }

    const BOUND: Bound = Bound::Unbounded;
}
