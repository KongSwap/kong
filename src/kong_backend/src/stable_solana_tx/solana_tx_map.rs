use crate::stable_memory::{with_memory_manager, SOLANA_TX_NOTIFICATIONS_ID};
use crate::stable_solana_tx::stable_solana_tx::SolanaTransaction;
use ic_stable_structures::{memory_manager::VirtualMemory, DefaultMemoryImpl, StableBTreeMap};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    // stable memory for storing Solana transactions
    pub static SOLANA_TX_MAP: RefCell<StableBTreeMap<String, SolanaTransaction, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(SOLANA_TX_NOTIFICATIONS_ID)))
    });
}

/// Insert or update a Solana transaction
pub fn insert(signature: String, transaction: SolanaTransaction) {
    SOLANA_TX_MAP.with(|map| {
        map.borrow_mut().insert(signature, transaction);
    });
}

/// Get a Solana transaction by signature
pub fn get(signature: &str) -> Option<SolanaTransaction> {
    SOLANA_TX_MAP.with(|map| map.borrow().get(&signature.to_string()))
}

/// Check if a transaction exists
pub fn exists(signature: &str) -> bool {
    SOLANA_TX_MAP.with(|map| map.borrow().contains_key(&signature.to_string()))
}

/// Get all transactions (for debugging/admin purposes)
pub fn get_all() -> Vec<(String, SolanaTransaction)> {
    SOLANA_TX_MAP.with(|map| {
        map.borrow()
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    })
}