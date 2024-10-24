use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

/// Data structure for the arguments of the `send` function.
/// Used in StableRequest
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SendArgs {
    pub token: String,
    pub amount: Nat,
    pub to_address: String,
}
