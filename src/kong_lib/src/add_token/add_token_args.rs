use candid::CandidType;
use serde::{Deserialize, Serialize};

/// Arguments for adding a token.
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddTokenArgs {
    pub token: String,
    pub on_kong: Option<bool>,
}
