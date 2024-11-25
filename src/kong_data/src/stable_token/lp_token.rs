use candid::CandidType;
use serde::{Deserialize, Serialize};

use super::stable_token::StableToken;
use super::token;

use crate::chains::chains::LP_CHAIN;
use crate::stable_pool::pool_map;
use crate::stable_pool::stable_pool::StablePool;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct LPToken {
    pub token_id: u32,
    pub symbol: String,
    pub address: String, // unique identifier for the token
    pub decimals: u8,
    pub on_kong: bool,
}

impl LPToken {
    pub fn name(&self) -> String {
        format!("{} LP Token", self.symbol)
    }

    pub fn chain(&self) -> String {
        LP_CHAIN.to_string()
    }
}
