use candid::{CandidType, Deserialize, Principal};
use ic_stable_structures::Storable;
use serde;

// Constants
pub const MAX_MESSAGE_LENGTH: usize = 280; // Twitter-style limit
pub const MAX_MESSAGES_STORED: usize = 100; // Keep last 100 messages
pub const MAX_USERNAME_LENGTH: usize = 32;
pub const DEFAULT_PAGE_SIZE: usize = 20;

// Message structure
#[derive(CandidType, Deserialize, Clone, Debug, serde::Serialize)]
pub struct Message {
    pub id: u64,
    pub message: String,
    pub principal: Principal,
    pub created_at: u64,
}

impl Storable for Message { 
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        let bytes = serde_json::to_vec(&self).unwrap();
        std::borrow::Cow::Owned(bytes)
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Unbounded;
}

#[derive(CandidType, Deserialize)]
pub struct PaginationParams {
    pub cursor: Option<u64>,  // nat64 in Candid
    pub limit: Option<u64>,   // nat64 in Candid
}

#[derive(CandidType)]
pub struct MessagesPage {
    pub messages: Vec<Message>,
    pub next_cursor: Option<u64>,
} 