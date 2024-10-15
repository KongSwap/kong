use candid::CandidType;
use serde::Serialize;

#[derive(CandidType, Serialize)]
pub struct LPReply {
    pub symbol: String,
    pub name: String,
    pub balance: f64,
    pub usd_balance: f64,
    pub symbol_0: String,
    pub amount_0: f64,
    pub usd_amount_0: f64,
    pub symbol_1: String,
    pub amount_1: f64,
    pub usd_amount_1: f64,
    pub ts: u64,
}
