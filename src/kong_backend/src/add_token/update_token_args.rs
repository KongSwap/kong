use candid::CandidType;
use serde::{Deserialize, Serialize};

/// Arguments for updating a token.
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTokenArgs {
    pub token: String,
}
