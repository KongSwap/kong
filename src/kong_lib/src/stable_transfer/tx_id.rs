use std::fmt::{self, Display, Formatter};

use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TxId {
    BlockIndex(Nat),
    TransactionId(String),
}

impl Display for TxId {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        match self {
            TxId::BlockIndex(nat) => write!(f, "{}", nat),
            TxId::TransactionId(str) => write!(f, "{}", str),
        }
    }
}
