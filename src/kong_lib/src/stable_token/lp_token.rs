use std::fs::Metadata;

use candid::CandidType;
use serde::{Deserialize, Serialize};

use super::stable_token::StableToken;
use super::token;

use crate::chains::chains::LP_CHAIN;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct LPToken {
    pub token_id: u32,
    pub symbol: String,
    pub address: String, // unique identifier for the token
    pub decimals: u8,
    pub on_kong: bool,
    pub metadata: Option<String>,
}

impl LPToken {
    pub fn new(token_0: &StableToken, token_1: &StableToken, decimals: u8, on_kong: bool, metadata: Option<String>) -> Self {
        let symbol = token::symbol(token_0, token_1);
        // LP token's address is the combination of token_0's token_id and token_1's token_id
        // which is unique making it a unique identifier for the LP token
        let address = token::address(token_0, token_1);
        Self {
            token_id: 0,
            symbol,
            address,
            decimals,
            on_kong,
            metadata,
        }
    }

    pub fn name(&self) -> String {
        format!("{} LP Token", self.symbol)
    }

    pub fn chain(&self) -> String {
        LP_CHAIN.to_string()
    }
}
