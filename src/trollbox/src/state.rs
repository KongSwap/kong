use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::RefCell;
use crate::types::Message;
use regex::Regex;
use lazy_static::lazy_static;
use rustrict::{CensorStr, Type, Censor};
use std::collections::HashMap;
use candid::Principal;

// Type aliases
pub type Memory = VirtualMemory<DefaultMemoryImpl>;

// Spam prevention constants
pub const MIN_MESSAGE_INTERVAL_NS: u64 = 5_000_000_000; // 5 seconds in nanoseconds

thread_local! {
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    pub static MESSAGE_STORE: RefCell<StableBTreeMap<u64, Message, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        )
    );

    pub static MESSAGE_COUNTER: RefCell<u64> = RefCell::new(0);
    
    // Track last message timestamp per user for spam prevention
    pub static LAST_MESSAGE_TIME: RefCell<HashMap<Principal, u64>> = RefCell::new(HashMap::new());
}

lazy_static! {
    static ref HTML_TAG_RE: Regex = Regex::new("<[^>]+>").unwrap();
    static ref CSS_RULE_RE: Regex = Regex::new(r"\{[^\}]+\}|\bstyle\s*=").unwrap();
}

// Helper function to validate message content
pub fn validate_message(message: &str) -> Result<String, String> {
    use crate::types::MAX_MESSAGE_LENGTH;
    
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("Message cannot be empty".to_string());
    }
    if message.len() > MAX_MESSAGE_LENGTH {
        return Err(format!("Message too long. Maximum length is {}", MAX_MESSAGE_LENGTH));
    }

    // Check for HTML tags
    if HTML_TAG_RE.is_match(message) {
        return Err("HTML tags are not allowed".to_string());
    }

    // Check for CSS rules or inline styles
    if CSS_RULE_RE.is_match(message) {
        return Err("CSS styling is not allowed".to_string());
    }

    // Replace inappropriate words with "gorilla"
    let (censored, _) = Censor::from_str(message)
        .with_censor_replacement('🦍')
        .censor_and_analyze();
    
    Ok(censored)
} 