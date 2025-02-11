use candid::{CandidType, Deserialize};
use serde::Serialize;

pub type TimestampMillis = u64;

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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PushEventsArgs {
    pub events: Vec<IdempotentEvent>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Anonymizable {
    Public(String),
    Anonymize(String),
}
