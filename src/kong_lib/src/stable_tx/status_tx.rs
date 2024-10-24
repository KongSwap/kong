use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, PartialEq, Eq, Debug, Clone, Serialize, Deserialize)]
pub enum StatusTx {
    Success,
    Failed,
}
