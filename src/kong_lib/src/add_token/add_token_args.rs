use candid::CandidType;
use serde::{Deserialize, Serialize};

/// Arguments for adding a token.
#[allow(dead_code)]
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddTokenArgs {
    pub token: String,
}
