use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, Storable};
use std::cell::RefCell;
use crate::types::Message;
use regex::Regex;
use lazy_static::lazy_static;
use rustrict::{CensorStr, Type, Censor};
use std::collections::{HashMap, HashSet};
use candid::Principal;
use std::borrow::Cow;

// Type aliases
pub type Memory = VirtualMemory<DefaultMemoryImpl>;

// Define a storable wrapper for Principal and u64 for stable storage
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct PrincipalStorable(pub Principal);

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ExpiryTimeStorable(pub u64);

impl Storable for PrincipalStorable {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(self.0.as_slice().to_vec())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(Principal::from_slice(&bytes))
    }

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Unbounded;
}

impl Storable for ExpiryTimeStorable {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(self.0.to_le_bytes().to_vec())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let mut data = [0u8; 8];
        data.copy_from_slice(&bytes[0..8]);
        Self(u64::from_le_bytes(data))
    }

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Unbounded;
}

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

    pub static BANNED_USERS_STORE: RefCell<StableBTreeMap<PrincipalStorable, ExpiryTimeStorable, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))) // Use a different memory ID
        )
    );

    pub static MESSAGE_COUNTER: RefCell<u64> = RefCell::new(0);
    
    // Track last message timestamp per user for spam prevention
    pub static LAST_MESSAGE_TIME: RefCell<HashMap<Principal, u64>> = RefCell::new(HashMap::new());
    
    // Store admin principals
    pub static ADMINS: RefCell<HashSet<Principal>> = RefCell::new({
        let mut admins = HashSet::new();
        // The canister deployer/controller will be the initial admin
        // Add the specified admin
        if let Ok(principal) = Principal::from_text("6ydau-gqejl-yqbq7-tm2i5-wscbd-lsaxy-oaetm-dxddd-s5rtd-yrpq2-eae") {
            admins.insert(principal);
        }
        admins
    });
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

// Helper function to check if a user is banned
pub fn is_user_banned(principal: &Principal) -> Option<u64> {
    BANNED_USERS_STORE.with(|banned_users| {
        let store = banned_users.borrow();
        if let Some(ExpiryTimeStorable(expiry_time)) = store.get(&PrincipalStorable(principal.clone())) {
            let current_time = ic_cdk::api::time();
            
            // If ban has expired, remove the user from the banned list
            if current_time > expiry_time {
                drop(store); // Release the borrowed reference before mutating
                banned_users.borrow_mut().remove(&PrincipalStorable(principal.clone()));
                None
            } else {
                // Return remaining ban time in seconds
                Some((expiry_time - current_time) / 1_000_000_000)
            }
        } else {
            None
        }
    })
} 