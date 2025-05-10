use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub struct SOLReply {
    pub id: String,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub fee: u64,
    pub min_amount: u64,
    pub address: String, // Token program address or empty for native SOL
}