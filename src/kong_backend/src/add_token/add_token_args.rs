use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

/// Arguments for adding a token.
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddTokenArgs {
    pub token: String,
    // Optional fields for Solana tokens
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub decimals: Option<u8>,
    pub fee: Option<Nat>,
    pub program_id: Option<String>,
    pub total_supply: Option<Nat>,
}
