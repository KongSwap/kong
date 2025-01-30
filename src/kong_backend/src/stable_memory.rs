use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell};
use std::cell::RefCell;
use std::collections::BTreeMap;

use crate::stable_claim::stable_claim::{StableClaim, StableClaimId};
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_lp_token::stable_lp_token::{StableLPToken, StableLPTokenId};
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_request::stable_request::{StableRequest, StableRequestId};
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use crate::stable_tx::stable_tx::{StableTx, StableTxId};
use crate::stable_user::banned_user_map::BannedUser;
use crate::stable_user::stable_user::{StableUser, StableUserId};

type Memory = VirtualMemory<DefaultMemoryImpl>;

// stable memory
pub const KONG_SETTINGS_MEMORY_ID: MemoryId = MemoryId::new(20);
pub const USER_MEMORY_ID: MemoryId = MemoryId::new(21);
pub const TOKEN_MEMORY_ID: MemoryId = MemoryId::new(22);
pub const POOL_MEMORY_ID: MemoryId = MemoryId::new(23);
pub const TX_MEMORY_ID: MemoryId = MemoryId::new(24);
pub const TX_24H_MEMORY_ID: MemoryId = MemoryId::new(25);
pub const REQUEST_MEMORY_ID: MemoryId = MemoryId::new(26);
pub const TRANSFER_MEMORY_ID: MemoryId = MemoryId::new(27);
pub const CLAIM_MEMORY_ID: MemoryId = MemoryId::new(28);
pub const LP_TOKEN_MEMORY_ID: MemoryId = MemoryId::new(29);
// archives
pub const TX_ARCHIVE_MEMORY_ID: MemoryId = MemoryId::new(204);
pub const REQUEST_ARCHIVE_MEMORY_ID: MemoryId = MemoryId::new(205);
pub const TRANSFER_ARCHIVE_MEMORY_ID: MemoryId = MemoryId::new(206);

thread_local! {
    // static variable to store the map of principal_id to user_id
    pub static PRINCIPAL_ID_MAP: RefCell<BTreeMap<String, u32>> = RefCell::default();

    // static variable to list of temporary banned users
    pub static BANNED_USERS: RefCell<BTreeMap<u32, BannedUser>> = RefCell::default();

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

    // stable memory for storing txs for the last 24 hours. used for calculating rolling stats
    pub static TX_24H_MAP: RefCell<StableBTreeMap<StableTxId, StableTx, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_24H_MEMORY_ID)))
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
