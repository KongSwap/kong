use ic_stable_structures::{StableBTreeMap, memory_manager::VirtualMemory, DefaultMemoryImpl};
use std::cell::RefCell;

use crate::ic::network::ICNetwork;
use crate::stable_memory::with_memory_manager;
use super::types::{TransactionNotification, TransactionNotificationId};

type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    /// Stable map for Solana transaction notifications
    pub static SOLANA_TX_NOTIFICATIONS: RefCell<StableBTreeMap<TransactionNotificationId, TransactionNotification, Memory>> = 
        with_memory_manager(|memory_manager| {
            RefCell::new(StableBTreeMap::init(
                memory_manager.get(crate::stable_memory::SOLANA_TX_NOTIFICATIONS_ID)
            ))
        });
}

/// Store a transaction notification
pub fn store_transaction_notification(notification: TransactionNotification) {
    SOLANA_TX_NOTIFICATIONS.with(|notifications| {
        let mut map = notifications.borrow_mut();
        let key = TransactionNotificationId(notification.signature.clone());
        map.insert(key, notification);
    });
}

/// Get a transaction by signature
pub fn get_solana_transaction(signature: String) -> Option<TransactionNotification> {
    SOLANA_TX_NOTIFICATIONS.with(|notifications| {
        let map = notifications.borrow();
        let key = TransactionNotificationId(signature);
        map.get(&key)
    })
}

/// Check if a transaction exists
pub fn transaction_exists(signature: &str) -> bool {
    SOLANA_TX_NOTIFICATIONS.with(|notifications| {
        let map = notifications.borrow();
        let key = TransactionNotificationId(signature.to_string());
        map.contains_key(&key)
    })
}

/// Get transaction count for metrics
pub fn get_transaction_count() -> u64 {
    SOLANA_TX_NOTIFICATIONS.with(|notifications| {
        notifications.borrow().len()
    })
}

/// Clean up old notifications (older than 24 hours)
pub fn cleanup_old_notifications() -> u32 {
    const TWENTY_FOUR_HOURS_NANOS: u64 = 24 * 60 * 60 * 1_000_000_000;
    let current_time = ICNetwork::get_time();
    let cutoff_time = current_time.saturating_sub(TWENTY_FOUR_HOURS_NANOS);
    
    let mut removed_count = 0u32;
    
    SOLANA_TX_NOTIFICATIONS.with(|notifications| {
        let mut map = notifications.borrow_mut();
        let mut to_remove = Vec::new();
        
        // Find old entries
        for (key, notification) in map.iter() {
            if notification.timestamp < cutoff_time {
                to_remove.push(key.clone());
            }
        }
        
        // Remove them
        for key in to_remove {
            map.remove(&key);
            removed_count += 1;
        }
    });
    
    removed_count
}