use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, PartialEq, Eq, Debug, Clone, Serialize, Deserialize)]
pub enum StatusTx {
    Success,
    Failed,
}

impl std::fmt::Display for StatusTx {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            StatusTx::Success => write!(f, "Success"),
            StatusTx::Failed => write!(f, "Failed"),
        }
    }
}
