use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

/// Arguments for adding a token.
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddTokenArgs {
    pub token: String,
    // Optional fields for Solana tokens
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub symbol: Option<String>,
    #[serde(default)]
    pub decimals: Option<u8>,
    #[serde(default)]
    pub fee: Option<Nat>,
    #[serde(default)]
    pub program_id: Option<String>,
    #[serde(default)]
    pub total_supply: Option<Nat>,
}

impl Default for AddTokenArgs {
    fn default() -> Self {
        Self {
            token: String::new(),
            name: None,
            symbol: None,
            decimals: None,
            fee: None,
            program_id: None,
            total_supply: None,
        }
    }
}
