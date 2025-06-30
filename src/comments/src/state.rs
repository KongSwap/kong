use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, Storable};
use std::cell::RefCell;
use crate::types::Comment;
use regex::Regex;
use lazy_static::lazy_static;
use rustrict::Censor;
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
pub const MIN_COMMENT_INTERVAL_NS: u64 = 5_000_000_000; // 5 seconds between comments

thread_local! {
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    pub static COMMENT_STORE: RefCell<StableBTreeMap<u64, Comment, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        )
    );

    pub static BANNED_USERS_STORE: RefCell<StableBTreeMap<PrincipalStorable, ExpiryTimeStorable, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))) // Use a different memory ID
        )
    );

    pub static COMMENT_COUNTER: RefCell<u64> = RefCell::new(0);
    
    // Track last comment timestamp per user for spam prevention
    pub static LAST_COMMENT_TIME: RefCell<HashMap<Principal, u64>> = RefCell::new(HashMap::new());
    
    // Track comment counts per context for statistics
    pub static CONTEXT_COMMENT_COUNT: RefCell<HashMap<String, u32>> = RefCell::new(HashMap::new());
    
    // Track user likes on comments (user principal -> set of comment ids)
    pub static USER_LIKES: RefCell<HashMap<Principal, HashSet<u64>>> = RefCell::new(HashMap::new());
    
    // Store admin principals
    pub static ADMINS: RefCell<HashSet<Principal>> = RefCell::new({
        let mut admins = HashSet::new();
        // The canister deployer/controller will be the initial admin
        // Add the specified admin
        if let Ok(principal) = Principal::from_text("fmlck-tlm2l-l33tz-qspuz-4omct-54vzm-5ciga-ru3ge-awtjs-jezfa-yqe") {
            admins.insert(principal);
        }
        if let Ok(principal) = Principal::from_text("hkxzv-wmenl-q4d3b-j3o5s-yucpn-g5itu-b3zmq-hxggl-s3atg-vryjf-dqe") {
            admins.insert(principal);
        }
        admins
    });
}

lazy_static! {
    // Simple HTML tag detection
    static ref HTML_TAG_RE: Regex = Regex::new(r"<[^>]+>").unwrap();
    // Dangerous HTML tags
    static ref DANGEROUS_HTML_RE: Regex = Regex::new(r"<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|label|fieldset|legend|datalist|output|frame|frameset|marquee|blink|link|meta|base|applet|body|head|html|title)[^>]*>").unwrap();
    static ref CSS_RULE_RE: Regex = Regex::new(r"\{[^\}]+\}|\bstyle\s*=").unwrap();
    static ref JAVASCRIPT_RE: Regex = Regex::new(r"(javascript:|onerror\s*=|onclick\s*=|onload\s*=|onmouseover\s*=|<\s*script)").unwrap();
    // Markdown patterns
    static ref MARKDOWN_IMAGE_RE: Regex = Regex::new(r"!\[([^\]]*)\]\(([^)]+)\)").unwrap();
    static ref MARKDOWN_LINK_RE: Regex = Regex::new(r"\[([^\]]+)\]\(([^)]+)\)").unwrap();
    static ref MARKDOWN_CODE_BLOCK_RE: Regex = Regex::new(r"```[\s\S]*?```").unwrap();
    // URL validation patterns
    static ref SAFE_IMAGE_URL_RE: Regex = Regex::new(r"^https?://[^\s<>]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s<>]*)?$").unwrap();
    static ref GIF_SERVICE_RE: Regex = Regex::new(r"^https?://(media\.giphy\.com|i\.giphy\.com|media[0-9]*\.giphy\.com|tenor\.com|c\.tenor\.com|imgur\.com|i\.imgur\.com)").unwrap();
    static ref SAFE_URL_RE: Regex = Regex::new(r"^https?://[^\s<>]+$").unwrap();
}

// Helper function to validate comment content
pub fn validate_comment(content: &str) -> Result<String, String> {
    use crate::types::MAX_COMMENT_LENGTH;
    
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("Comment cannot be empty".to_string());
    }
    if content.len() > MAX_COMMENT_LENGTH {
        return Err(format!("Comment too long. Maximum length is {}", MAX_COMMENT_LENGTH));
    }

    // Check for dangerous HTML tags
    if DANGEROUS_HTML_RE.is_match(content) {
        return Err("Dangerous HTML tags are not allowed".to_string());
    }

    // Check for CSS rules or inline styles
    if CSS_RULE_RE.is_match(content) {
        return Err("CSS styling is not allowed".to_string());
    }

    // Check for JavaScript patterns
    if JAVASCRIPT_RE.is_match(content) {
        return Err("JavaScript code is not allowed".to_string());
    }

    // Sanitize the content
    let mut sanitized = content.to_string();
    
    // Remove all HTML tags
    sanitized = HTML_TAG_RE.replace_all(&sanitized, "").to_string();
    
    // Validate markdown images - ensure they use safe URLs
    let sanitized_with_images = MARKDOWN_IMAGE_RE.replace_all(&sanitized, |caps: &regex::Captures| {
        let alt_text = &caps[1];
        let url = &caps[2];
        
        // Check if the URL is safe (https and proper image extension or known GIF service)
        if SAFE_IMAGE_URL_RE.is_match(url) || GIF_SERVICE_RE.is_match(url) {
            format!("![{}]({})", alt_text, url)
        } else {
            // Replace unsafe image URLs with text
            format!("[Image: {}]", alt_text)
        }
    }).to_string();
    
    // Validate markdown links - ensure they use safe URLs
    let sanitized_with_links = MARKDOWN_LINK_RE.replace_all(&sanitized_with_images, |caps: &regex::Captures| {
        let link_text = &caps[1];
        let url = &caps[2];
        
        // Check if the URL is safe (https)
        if SAFE_URL_RE.is_match(url) && url.starts_with("https://") {
            format!("[{}]({})", link_text, url)
        } else {
            // Replace unsafe URLs with just the text
            link_text.to_string()
        }
    }).to_string();

    // Apply content filtering for profanity
    let (censored, _) = Censor::from_str(&sanitized_with_links)
        .with_censor_replacement('*')
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