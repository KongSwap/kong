use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TxId {
    BlockIndex(Nat),
    TransactionHash(String),
    Signature(String), // For Solana transaction signatures
}

impl TxId {
    pub fn to_string(&self) -> String {
        match self {
            TxId::BlockIndex(nat) => format!("BLK:{}", nat),
            TxId::TransactionHash(hash) => format!("HASH:{}", hash),
            TxId::Signature(sig) => format!("SIG:{}", sig),
        }
    }
}