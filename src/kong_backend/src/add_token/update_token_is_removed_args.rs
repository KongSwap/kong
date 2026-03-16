use candid::CandidType;
use serde::{Deserialize, Serialize};

/// Arguments for updating a token's is_removed field.
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTokenIsRemovedArgs {
    pub token: String,
    pub is_removed: bool,
}