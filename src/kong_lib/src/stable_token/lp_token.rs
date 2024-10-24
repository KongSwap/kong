use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct LPToken {
    pub token_id: u32,
    pub symbol: String,
    pub address: String, // unique identifier for the token
    pub decimals: u8,
    pub on_kong: bool,
}
