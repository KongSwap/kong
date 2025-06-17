use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell};
use std::cell::RefCell;
use std::collections::BTreeMap;

use crate::stable_claim::stable_claim::{StableClaim, StableClaimId};
use crate::stable_db_update::stable_db_update::{StableDBUpdate, StableDBUpdateId};
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_lp_token::stable_lp_token::{StableLPToken, StableLPTokenId};
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_request::stable_request::{StableRequest, StableRequestId};
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use crate::stable_tx::stable_tx::{StableTx, StableTxId};
use crate::stable_user::stable_user::{StableUser, StableUserId};

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Stable memory
pub const KONG_SETTINGS_MEMORY_ID: MemoryId = MemoryId::new(0);
pub const USER_MEMORY_ID: MemoryId = MemoryId::new(1);
pub const TOKEN_MEMORY_ID: MemoryId = MemoryId::new(2);
pub const POOL_MEMORY_ID: MemoryId = MemoryId::new(3);
pub const TX_MEMORY_ID: MemoryId = MemoryId::new(4);
pub const REQUEST_MEMORY_ID: MemoryId = MemoryId::new(5);
pub const TRANSFER_MEMORY_ID: MemoryId = MemoryId::new(6);
pub const CLAIM_MEMORY_ID: MemoryId = MemoryId::new(7);
pub const LP_TOKEN_MEMORY_ID: MemoryId = MemoryId::new(8);
pub const DB_UPDATE_MEMORY_ID: MemoryId = MemoryId::new(50);

thread_local! {
    // Static variables
    pub static PRINCIPAL_ID_MAP: RefCell<BTreeMap<String, u32>> = RefCell::default();

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

    // stable memory for storing stable memory updates
    pub static DB_UPDATE_MAP: RefCell<StableBTreeMap<StableDBUpdateId, StableDBUpdate, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(DB_UPDATE_MEMORY_ID)))
    });
}

/// A helper function to access the memory manager.
fn with_memory_manager<R>(f: impl FnOnce(&MemoryManager<DefaultMemoryImpl>) -> R) -> R {
    MEMORY_MANAGER.with(|cell| f(&cell.borrow()))
}
