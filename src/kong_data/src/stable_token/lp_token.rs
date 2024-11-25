use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::chains::chains::LP_CHAIN;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct LPToken {
    pub token_id: u32,
    pub symbol: String,
    pub address: String, // unique identifier for the token
    pub decimals: u8,
    pub on_kong: bool,
}

impl LPToken {
    pub fn chain(&self) -> String {
        LP_CHAIN.to_string()
    }
}
