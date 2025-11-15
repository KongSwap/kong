use candid::{CandidType, Deserialize};
use serde::Serialize;

#[allow(dead_code)]
pub type TimestampMillis = u64;

#[allow(dead_code)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct IdempotentEvent {
    pub idempotency_key: u128,
    pub name: String,
    pub timestamp: TimestampMillis,
    pub user: Option<Anonymizable>,
    pub source: Option<Anonymizable>,
    #[serde(with = "serde_bytes")]
    pub payload: Vec<u8>,
}

#[allow(dead_code)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PushEventsArgs {
    pub events: Vec<IdempotentEvent>,
}

#[allow(dead_code)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Anonymizable {
    Public(String),
    Anonymize(String),
}
