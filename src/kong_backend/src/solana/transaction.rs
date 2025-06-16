use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::str::FromStr;

use super::error::SolanaError;

#[derive(Clone, Debug, CandidType, Serialize, Deserialize, PartialEq)] // Added PartialEq
pub enum SolanaTransactionStatus {
    Pending,
    Confirmed,
    Finalized,
    Failed,
    TimedOut,
}

impl FromStr for SolanaTransactionStatus {
    type Err = SolanaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Pending" => Ok(SolanaTransactionStatus::Pending),
            "Confirmed" => Ok(SolanaTransactionStatus::Confirmed),
            "Finalized" => Ok(SolanaTransactionStatus::Finalized),
            "Failed" => Ok(SolanaTransactionStatus::Failed),
            "TimedOut" => Ok(SolanaTransactionStatus::TimedOut),
            _ => Err(SolanaError::UpdateTransactionError(format!("Invalid status: {}", s))),
        }
    }
}

#[derive(Clone, Debug, CandidType, Serialize, Deserialize)]
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
    
    // Transaction amount (from RPC)
    pub amount: Option<u64>,
    
    // Transaction fee (from RPC)
    pub fee: Option<u64>,
    
    // Sender address (from RPC)
    pub sender: Option<String>,
    
    // Receiver address (from RPC)
    pub receiver: Option<String>,
    
    // Transaction direction (Incoming, Outgoing, Self)
    pub direction: Option<String>,
    
    // Transaction timestamp from Solana (from blockTime)
    pub transaction_time: Option<String>,
    
    // Transaction instruction type
    pub instruction_type: Option<String>,
    
    // Balance change amount if available
    pub balance_change: Option<u64>,

    // Additional metadata (JSON string)
    pub metadata: Option<String>,
}

impl Storable for SolanaTransaction {
    const BOUND: Bound = Bound::Unbounded;

    fn to_bytes(&self) -> Cow<[u8]> {
        serde_cbor::to_vec(self)
            .expect("Failed to encode SolanaTransaction")
            .into()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("Failed to decode SolanaTransaction")
    }
}
