use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::chains::chains::SOL_CHAIN;
use crate::helpers::nat_helpers::nat_zero;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SolanaToken {
    pub token_id: u32,
    pub name: String,
    pub symbol: String,
    pub mint_address: String, // Solana mint public key in base58 format
    pub decimals: u8,
    pub fee: Nat, // Transaction fee in lamports
    #[serde(default = "false_bool")]
    pub is_removed: bool,
}

fn false_bool() -> bool {
    false
}

impl SolanaToken {
    pub fn new(mint_address: String, name: String, symbol: String, decimals: u8) -> Self {
        Self {
            token_id: 0,
            name,
            symbol,
            mint_address,
            decimals,
            fee: nat_zero(), // Fee will be determined dynamically based on network conditions
            is_removed: false,
        }
    }

    pub fn chain(&self) -> String {
        SOL_CHAIN.to_string()
    }
}