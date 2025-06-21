use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub struct SolanaReply {
    pub token_id: u32,
    pub chain: String,
    pub name: String,
    pub symbol: String,
    pub mint_address: String,
    pub program_id: String,
    pub decimals: u8,
    pub fee: Nat,
    pub total_supply: Option<Nat>,
    pub is_spl_token: bool,
}