use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell};
use std::cell::RefCell;
use std::collections::BTreeMap;

use crate::solana::latest_blockhash::LatestBlockhash;
use crate::solana::proxy::types::{TransactionNotification, TransactionNotificationId};
use crate::stable_claim::stable_claim::{StableClaim, StableClaimId};
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_lp_token::stable_lp_token::{StableLPToken, StableLPTokenId};
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_request::stable_request::{StableRequest, StableRequestId};
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use crate::stable_tx::stable_tx::{StableTx, StableTxId};
use crate::stable_user::stable_user::{StableUser, StableUserId};
use crate::stable_user::suspended_user_map::SuspendedUser;
use crate::swap::swap_job::SwapJob;

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Stable memory
pub const KONG_SETTINGS_MEMORY_ID: MemoryId = MemoryId::new(20);
pub const USER_MEMORY_ID: MemoryId = MemoryId::new(21);
pub const TOKEN_MEMORY_ID: MemoryId = MemoryId::new(22);
pub const POOL_MEMORY_ID: MemoryId = MemoryId::new(23);
pub const TX_MEMORY_ID: MemoryId = MemoryId::new(24);
pub const REQUEST_MEMORY_ID: MemoryId = MemoryId::new(26);
pub const TRANSFER_MEMORY_ID: MemoryId = MemoryId::new(27);
pub const CLAIM_MEMORY_ID: MemoryId = MemoryId::new(28);
pub const LP_TOKEN_MEMORY_ID: MemoryId = MemoryId::new(29);
// Stable memory for Solana
pub const CACHED_SOLANA_ADDRESS_ID: MemoryId = MemoryId::new(60);
pub const SOLANA_LATEST_BLOCKHASH_ID: MemoryId = MemoryId::new(61);
pub const NEXT_SOLANA_SWAP_JOB_ID_ID: MemoryId = MemoryId::new(62);
pub const SOLANA_SWAP_JOB_QUEUE_ID: MemoryId = MemoryId::new(63);
pub const SOLANA_TX_NOTIFICATIONS_ID: MemoryId = MemoryId::new(64);
// Archives
pub const TX_ARCHIVE_MEMORY_ID: MemoryId = MemoryId::new(204);
pub const REQUEST_ARCHIVE_MEMORY_ID: MemoryId = MemoryId::new(205);
pub const TRANSFER_ARCHIVE_MEMORY_ID: MemoryId = MemoryId::new(206);

thread_local! {
    // Static variables
    pub static PRINCIPAL_ID_MAP: RefCell<BTreeMap<String, u32>> = RefCell::default();
    pub static SUSPENDED_USERS: RefCell<BTreeMap<u32, SuspendedUser>> = RefCell::default();

    // MEMORY_MANAGER is given management of the entire stable memory. Given a 'MemoryId', it can
    // return a memory that can be used by stable structures
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // stable memory for storing Kong settings
    pub static KONG_SETTINGS: RefCell<StableCell<StableKongSettings, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableCell::init(memory_manager.get(KONG_SETTINGS_MEMORY_ID), StableKongSettings::default()).expect("Failed to initialize Kong settings"))
    });

    // stable memory for storing user profiles
    pub static USER_MAP: RefCell<StableBTreeMap<StableUserId, StableUser, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(USER_MEMORY_ID)))
    });

    // stable memory for storing tokens supported by the system
    pub static TOKEN_MAP: RefCell<StableBTreeMap<StableTokenId, StableToken, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TOKEN_MEMORY_ID)))
    });

    // stable memory for storing pools
    pub static POOL_MAP: RefCell<StableBTreeMap<StablePoolId, StablePool, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(POOL_MEMORY_ID)))
    });

    // stable memory for storing all transactions
    pub static TX_MAP: RefCell<StableBTreeMap<StableTxId, StableTx, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_MEMORY_ID)))
    });

    // stable memory for storing all requests made by users
    pub static REQUEST_MAP: RefCell<StableBTreeMap<StableRequestId, StableRequest, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(REQUEST_MEMORY_ID)))
    });

    // stable memory for storing all on-chain transfers with block_id. used to prevent accepting transfer twice (double receive)
    pub static TRANSFER_MAP: RefCell<StableBTreeMap<StableTransferId, StableTransfer, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TRANSFER_MEMORY_ID)))
    });

    // stable memory for storing all claims for users
    pub static CLAIM_MAP: RefCell<StableBTreeMap<StableClaimId, StableClaim, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(CLAIM_MEMORY_ID)))
    });

    // stable memory for storing all LP tokens for users
    pub static LP_TOKEN_MAP: RefCell<StableBTreeMap<StableLPTokenId, StableLPToken, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(LP_TOKEN_MEMORY_ID)))
    });

    // Cached Solana address (persisted)
    pub static CACHED_SOLANA_ADDRESS: RefCell<StableCell<String, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableCell::init(memory_manager.get(CACHED_SOLANA_ADDRESS_ID), String::new()).expect("Failed to initialize CACHED_SOLANA_ADDRESS cell")
        )
    });

    // stableCell for the latest blockhash and timestamp (persisted)
    pub static SOLANA_LATEST_BLOCKHASH: RefCell<StableCell<LatestBlockhash, Memory>> =  with_memory_manager(|memory_manager| {
        RefCell::new(StableCell::init(memory_manager.get(SOLANA_LATEST_BLOCKHASH_ID), LatestBlockhash::default()).expect("Failed to initialize SOLANA_LATEST_BLOCKHASH cell"))
    });

    // Counter for Solana swap job IDs (persisted)
    pub static NEXT_SOLANA_SWAP_JOB_ID: RefCell<StableCell<u64, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableCell::init(memory_manager.get(NEXT_SOLANA_SWAP_JOB_ID_ID), 0u64).expect("Failed to initialize NEXT_SOLANA_SWAP_JOB_ID cell"))
    });

    // Stable map for Solana swap jobs
    pub static SOLANA_SWAP_JOB_QUEUE: RefCell<StableBTreeMap<u64, SwapJob, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(SOLANA_SWAP_JOB_QUEUE_ID)))
    });

    // Stable map for Solana transaction notifications
    pub static SOLANA_TX_NOTIFICATIONS: RefCell<StableBTreeMap<TransactionNotificationId, TransactionNotification, Memory>> = 
        with_memory_manager(|memory_manager| {
            RefCell::new(StableBTreeMap::init(
                memory_manager.get(SOLANA_TX_NOTIFICATIONS_ID)
            ))
        });

    //
    // Archive Stable Memory
    //

    // stable memory for storing tx archive
    pub static TX_ARCHIVE_MAP: RefCell<StableBTreeMap<StableTxId, StableTx, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_ARCHIVE_MEMORY_ID)))
    });

    // stable memory for storing request archive
    pub static REQUEST_ARCHIVE_MAP: RefCell<StableBTreeMap<StableRequestId, StableRequest, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(REQUEST_ARCHIVE_MEMORY_ID)))
    });

    // stable memory for storing transfer archive
    pub static TRANSFER_ARCHIVE_MAP: RefCell<StableBTreeMap<StableTransferId, StableTransfer, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TRANSFER_ARCHIVE_MEMORY_ID)))
    });
}

/// A helper function to access the memory manager.
pub fn with_memory_manager<R>(f: impl FnOnce(&MemoryManager<DefaultMemoryImpl>) -> R) -> R {
    MEMORY_MANAGER.with(|cell| f(&cell.borrow()))
}

/// Helper function to access the cached Solana address
pub fn with_cached_solana_address<R>(f: impl FnOnce(&StableCell<String, Memory>) -> R) -> R {
    CACHED_SOLANA_ADDRESS.with(|cell| f(&cell.borrow()))
}

/// Helper function to mutate the cached Solana address
pub fn with_cached_solana_address_mut<R>(f: impl FnOnce(&mut StableCell<String, Memory>) -> R) -> R {
    CACHED_SOLANA_ADDRESS.with(|cell| f(&mut cell.borrow_mut()))
}

/// Get the cached Solana address from stable memory
pub fn get_cached_solana_address() -> String {
    with_cached_solana_address(|cell| cell.get().clone())
}

/// Set the cached Solana address in stable memory
pub fn set_cached_solana_address(address: String) {
    with_cached_solana_address_mut(|cell| {
        cell.set(address).expect("Failed to set cached Solana address");
    });
}

/// Helper function to access the latest blockhash cell
pub fn with_solana_latest_blockhash<R>(f: impl FnOnce(&StableCell<LatestBlockhash, Memory>) -> R) -> R {
    SOLANA_LATEST_BLOCKHASH.with(|cell| f(&cell.borrow()))
}

/// Helper function to mutate the latest blockhash cell
pub fn with_solana_latest_blockhash_mut<R>(f: impl FnOnce(&mut StableCell<LatestBlockhash, Memory>) -> R) -> R {
    SOLANA_LATEST_BLOCKHASH.with(|cell| f(&mut cell.borrow_mut()))
}

/// Get the next unique ID for a Solana swap job and increment the counter.
pub fn get_next_solana_swap_job_id() -> u64 {
    NEXT_SOLANA_SWAP_JOB_ID.with(|cell| {
        let current_id = *cell.borrow().get();
        let next_id = current_id + 1;
        // Before updating, ensure the cell isn't borrowed mutably elsewhere if using set directly.
        // For StableCell, it's simpler:
        cell.borrow_mut().set(next_id).expect("Failed to set next_solana_swap_job_id");
        current_id
    })
}

/// Helper function to access the swap job queue
pub fn with_swap_job_queue<R>(f: impl FnOnce(&StableBTreeMap<u64, SwapJob, Memory>) -> R) -> R {
    SOLANA_SWAP_JOB_QUEUE.with(|cell| f(&cell.borrow()))
}

/// Helper function to mutate the swap job queue
pub fn with_swap_job_queue_mut<R>(f: impl FnOnce(&mut StableBTreeMap<u64, SwapJob, Memory>) -> R) -> R {
    SOLANA_SWAP_JOB_QUEUE.with(|cell| f(&mut cell.borrow_mut()))
}

/// Helper function to access solana transaction notifications
pub fn with_solana_tx_notifications<R>(f: impl FnOnce(&StableBTreeMap<TransactionNotificationId, TransactionNotification, Memory>) -> R) -> R {
    SOLANA_TX_NOTIFICATIONS.with(|cell| f(&cell.borrow()))
}

/// Helper function to mutate solana transaction notifications
pub fn with_solana_tx_notifications_mut<R>(f: impl FnOnce(&mut StableBTreeMap<TransactionNotificationId, TransactionNotification, Memory>) -> R) -> R {
    SOLANA_TX_NOTIFICATIONS.with(|cell| f(&mut cell.borrow_mut()))
}

/// Store a transaction notification
pub fn store_transaction_notification(notification: TransactionNotification) {
    with_solana_tx_notifications_mut(|notifications| {
        let key = TransactionNotificationId(notification.signature.clone());
        notifications.insert(key, notification);
    });
}

/// Get a transaction by signature
pub fn get_solana_transaction(signature: String) -> Option<TransactionNotification> {
    with_solana_tx_notifications(|notifications| {
        let key = TransactionNotificationId(signature);
        notifications.get(&key)
    })
}

/// Check if a transaction exists
pub fn transaction_exists(signature: &str) -> bool {
    with_solana_tx_notifications(|notifications| {
        let key = TransactionNotificationId(signature.to_string());
        notifications.contains_key(&key)
    })
}

/// Get transaction count for metrics
pub fn get_transaction_count() -> u64 {
    with_solana_tx_notifications(|notifications| {
        notifications.len()
    })
}

/// Clean up old notifications (older than 24 hours)
pub fn cleanup_old_notifications() -> u32 {
    use crate::ic::network::ICNetwork;
    
    const TWENTY_FOUR_HOURS_NANOS: u64 = 24 * 60 * 60 * 1_000_000_000;
    let current_time = ICNetwork::get_time();
    let cutoff_time = current_time.saturating_sub(TWENTY_FOUR_HOURS_NANOS);
    
    let mut removed_count = 0u32;
    
    with_solana_tx_notifications_mut(|notifications| {
        let mut to_remove = Vec::new();
        
        // Find old entries
        for (key, notification) in notifications.iter() {
            if notification.timestamp < cutoff_time {
                to_remove.push(key.clone());
            }
        }
        
        // Remove them
        for key in to_remove {
            notifications.remove(&key);
            removed_count += 1;
        }
    });
    
    removed_count
}
