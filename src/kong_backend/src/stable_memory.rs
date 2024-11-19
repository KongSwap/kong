use ic_cdk_timers::TimerId;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell};
use std::cell::{Cell, RefCell};

use crate::stable_claim::stable_claim::{StableClaim, StableClaimId};
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_lp_token_ledger::stable_lp_token_ledger::{StableLPTokenLedger, StableLPTokenLedgerId};
use crate::stable_message::stable_message::{StableMessage, StableMessageId};
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_request::stable_request::{StableRequest, StableRequestId};
use crate::stable_request::stable_request_alt::{StableRequestAlt, StableRequestIdAlt};
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use crate::stable_transfer::stable_transfer_alt::{StableTransferAlt, StableTransferIdAlt};
use crate::stable_tx::stable_tx::{StableTx, StableTxId};
use crate::stable_tx::stable_tx_alt::{StableTxAlt, StableTxIdAlt};
use crate::stable_user::stable_user::{StableUser, StableUserId};

type Memory = VirtualMemory<DefaultMemoryImpl>;

pub const KONG_SETTINGS_ID: MemoryId = MemoryId::new(0);
pub const USER_MEMORY_ID: MemoryId = MemoryId::new(1);
pub const TOKEN_MEMORY_ID: MemoryId = MemoryId::new(2);
pub const POOL_MEMORY_ID: MemoryId = MemoryId::new(3);
pub const TX_MEMORY_ID: MemoryId = MemoryId::new(4);
pub const REQUEST_MEMORY_ID: MemoryId = MemoryId::new(5);
pub const TRANSFER_MEMORY_ID: MemoryId = MemoryId::new(6);
pub const CLAIM_MEMORY_ID: MemoryId = MemoryId::new(7);
pub const LP_TOKEN_LEDGER_MEMORY_ID: MemoryId = MemoryId::new(8);
pub const MESSAGE_MEMORY_ID: MemoryId = MemoryId::new(9);
// additional
pub const TX_MEMORY_24H_ID: MemoryId = MemoryId::new(109);
// archives
pub const TX_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(204);
pub const REQUEST_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(205);
pub const TRANSFER_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(206);

thread_local! {
    // static variable to store the timer id for the background claims timer
    // doesn't need to be in stable memory as they are not persisted across upgrades
    pub static CLAIMS_TIMER_ID: Cell<TimerId> = Cell::default();

    // static variable to store the timer id for the background stats timer
    pub static STATS_TIMER_ID: Cell<TimerId> = Cell::default();

    // static variable to store the timer id for the background tx map archive timer
    pub static TX_MAP_ARCHIVE_TIMER_ID: Cell<TimerId> = Cell::default();

    // static variable to store the timer id for the background request map archive timer
    pub static REQUEST_MAP_ARCHIVE_TIMER_ID: Cell<TimerId> = Cell::default();

    // static variable to store the timer id for the background transfer archive timer
    pub static TRANSFER_MAP_ARCHIVE_TIMER_ID: Cell<TimerId> = Cell::default();

    // MEMORY_MANAGER is given management of the entire stable memory. Given a 'MemoryId', it can
    // return a memory that can be used by stable structures
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // stable memory for storing Kong settings
    pub static KONG_SETTINGS: RefCell<StableCell<StableKongSettings, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableCell::init(memory_manager.get(KONG_SETTINGS_ID), StableKongSettings::default()).expect("Failed to initialize Kong settings"))
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
    pub static LP_TOKEN_LEDGER: RefCell<StableBTreeMap<StableLPTokenLedgerId, StableLPTokenLedger, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(LP_TOKEN_LEDGER_MEMORY_ID)))
    });

    // stable memory for storing all messages
    pub static MESSAGE_MAP: RefCell<StableBTreeMap<StableMessageId, StableMessage, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(MESSAGE_MEMORY_ID)))
    });

    //
    // Additional Stable Memory
    //

    // stable memory for storing txs for the last 24 hours. used for calculating rolling stats
    pub static TX_24H_MAP: RefCell<StableBTreeMap<StableTxId, StableTx, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_MEMORY_24H_ID)))
    });

    //
    // Archive Stable Memory
    //

    // stable memory for storing tx archive
    pub static TX_ARCHIVE_MAP: RefCell<StableBTreeMap<StableTxIdAlt, StableTxAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing request archive
    pub static REQUEST_ARCHIVE_MAP: RefCell<StableBTreeMap<StableRequestIdAlt, StableRequestAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(REQUEST_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing transfer archive
    pub static TRANSFER_ARCHIVE_MAP: RefCell<StableBTreeMap<StableTransferIdAlt, StableTransferAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TRANSFER_MEMORY_ARCHIVE_ID)))
    });
}

/// A helper function to access the memory manager.
pub fn with_memory_manager<R>(f: impl FnOnce(&MemoryManager<DefaultMemoryImpl>) -> R) -> R {
    MEMORY_MANAGER.with(|cell| f(&cell.borrow()))
}
