use candid::{CandidType, Deserialize};
use ic_stable_structures::Storable;
use std::borrow::Cow;

#[derive(Clone, Debug, CandidType, Deserialize)]
pub enum SolanaTransactionStatus {
    Pending,
    Confirmed,
    Finalized,
    Failed,
    TimedOut,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct SolanaTransaction {
    // Unique identifier for the transaction
    pub id: String,
    
    // Solana transaction signature
    pub signature: String,
    
    // Current status of the transaction
    pub status: SolanaTransactionStatus,
    
    // Timestamp when the transaction was registered
    pub registered_at: u64,
    
    // Timestamp when the transaction was last updated
    pub updated_at: u64,
    
    // Additional metadata (JSON string)
    pub metadata: Option<String>,
}

impl Storable for SolanaTransaction {
    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Unbounded;
    
    fn to_bytes(&self) -> Cow<[u8]> {
        let bytes = candid::encode_one(self).expect("Failed to encode SolanaTransaction");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).expect("Failed to decode SolanaTransaction")
    }
}