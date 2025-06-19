use candid::{CandidType, Deserialize};
use ic_stable_structures::storable::{Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

/// Represents a Solana transaction notification stored in stable memory
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct SolanaTransaction {
    pub signature: String,
    pub status: String, // e.g., "processed", "confirmed", "finalized", "failed"
    pub metadata: Option<String>, // Store full RPC response or parsed details
    pub timestamp: u64,
}

impl Storable for SolanaTransaction {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_cbor::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}