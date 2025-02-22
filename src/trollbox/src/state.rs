use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::RefCell;
use crate::types::Message;

// Type aliases
pub type Memory = VirtualMemory<DefaultMemoryImpl>;

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
}

// Helper function to validate message content
pub fn validate_message(message: &str) -> Result<(), String> {
    use crate::types::MAX_MESSAGE_LENGTH;
    
    if message.trim().is_empty() {
        return Err("Message cannot be empty".to_string());
    }
    if message.len() > MAX_MESSAGE_LENGTH {
        return Err(format!("Message too long. Maximum length is {}", MAX_MESSAGE_LENGTH));
    }
    Ok(())
} 