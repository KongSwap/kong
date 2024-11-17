use ic_cdk_timers::TimerId;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell};
use std::cell::{Cell, RefCell};

use crate::stable_claim::stable_claim::{StableClaim, StableClaimId};
use crate::stable_claim::stable_claim_alt::{StableClaimAlt, StableClaimIdAlt};
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_kong_settings::stable_kong_settings_alt::StableKongSettingsAlt;
use crate::stable_lp_token_ledger::stable_lp_token_ledger::{StableLPTokenLedger, StableLPTokenLedgerId};
use crate::stable_lp_token_ledger::stable_lp_token_ledger_alt::{StableLPTokenLedgerAlt, StableLPTokenLedgerIdAlt};
use crate::stable_message::stable_message::{StableMessage, StableMessageId};
use crate::stable_message::stable_message_alt::{StableMessageAlt, StableMessageIdAlt};
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_pool::stable_pool_alt::{StablePoolAlt, StablePoolIdAlt};
use crate::stable_request::stable_request::{StableRequest, StableRequestId};
use crate::stable_request::stable_request_alt::{StableRequestAlt, StableRequestIdAlt};
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_token::stable_token_alt::{StableTokenAlt, StableTokenIdAlt};
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use crate::stable_transfer::stable_transfer_alt::{StableTransferAlt, StableTransferIdAlt};
use crate::stable_tx::stable_tx::{StableTx, StableTxId};
use crate::stable_tx::stable_tx_alt::{StableTxAlt, StableTxIdAlt};
use crate::stable_user::stable_user::{StableUser, StableUserId};
use crate::stable_user::stable_user_alt::{StableUserAlt, StableUserIdAlt};

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
// alternative - used when upgrading
pub const KONG_SETTINGS_ALT_ID: MemoryId = MemoryId::new(50);
pub const USER_MEMORY_ALT_ID: MemoryId = MemoryId::new(51);
pub const TOKEN_MEMORY_ALT_ID: MemoryId = MemoryId::new(52);
pub const POOL_MEMORY_ALT_ID: MemoryId = MemoryId::new(53);
pub const TX_MEMORY_ALT_ID: MemoryId = MemoryId::new(54);
pub const REQUEST_MEMORY_ALT_ID: MemoryId = MemoryId::new(55);
pub const TRANSFER_MEMORY_ALT_ID: MemoryId = MemoryId::new(56);
pub const CLAIM_MEMORY_ALT_ID: MemoryId = MemoryId::new(57);
pub const LP_TOKEN_LEDGER_MEMORY_ALT_ID: MemoryId = MemoryId::new(58);
pub const MESSAGE_MEMORY_ALT_ID: MemoryId = MemoryId::new(59);
// archives
pub const KONG_SETTINGS_ARCHIVE_ID: MemoryId = MemoryId::new(100);
pub const USER_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(101);
pub const TOKEN_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(102);
pub const POOL_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(103);
pub const TX_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(104);
pub const REQUEST_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(105);
pub const TRANSFER_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(106);
pub const CLAIM_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(107);
pub const LP_TOKEN_LEDGER_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(108);
pub const MESSAGE_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(111);
// additional
pub const TX_MEMORY_24H_ID: MemoryId = MemoryId::new(109);
pub const TRANSFER_MEMORY_1H_ID: MemoryId = MemoryId::new(110);

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

    // static variable to store the timer id for the background LP token ledger archive timer
    pub static LP_TOKEN_LEDGER_ARCHIVE_TIMER_ID: Cell<TimerId> = Cell::default();

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
    // Alternative Stable Memory
    //

    // stable memory for storing Kong settings (alternative)
    pub static KONG_SETTINGS_ALT: RefCell<StableCell<StableKongSettingsAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableCell::init(memory_manager.get(KONG_SETTINGS_ALT_ID), StableKongSettingsAlt::default()).expect("Failed to initialize Kong settings"))
    });

    // stable memory for storing user profiles (alternative)
    pub static USER_ALT_MAP: RefCell<StableBTreeMap<StableUserIdAlt, StableUserAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(USER_MEMORY_ALT_ID)))
    });

    // stable memory for storing tokens supported by the system (alternative)
    pub static TOKEN_ALT_MAP: RefCell<StableBTreeMap<StableTokenIdAlt, StableTokenAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TOKEN_MEMORY_ALT_ID)))
    });

    // stable memory for storing pools (alternative)
    pub static POOL_ALT_MAP: RefCell<StableBTreeMap<StablePoolIdAlt, StablePoolAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(POOL_MEMORY_ALT_ID)))
    });

    // stable memory for storing all transactions (alternative)
    pub static TX_ALT_MAP: RefCell<StableBTreeMap<StableTxIdAlt, StableTxAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_MEMORY_ALT_ID)))
    });

    // stable memory for storing all requests made by users (alternative)
    pub static REQUEST_ALT_MAP: RefCell<StableBTreeMap<StableRequestIdAlt, StableRequestAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(REQUEST_MEMORY_ALT_ID)))
    });

    // stable memory for storing all on-chain transfers with block_id. used to prevent accepting transfer twice (double receive) (alternative
    pub static TRANSFER_ALT_MAP: RefCell<StableBTreeMap<StableTransferIdAlt, StableTransferAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TRANSFER_MEMORY_ALT_ID)))
    });

    // stable memory for storing all claims for users (alternative)
    pub static CLAIM_ALT_MAP: RefCell<StableBTreeMap<StableClaimIdAlt, StableClaimAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(CLAIM_MEMORY_ALT_ID)))
    });

    // stable memory for storing all LP tokens for users (alternative)
    pub static LP_TOKEN_LEDGER_ALT: RefCell<StableBTreeMap<StableLPTokenLedgerIdAlt, StableLPTokenLedgerAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(LP_TOKEN_LEDGER_MEMORY_ALT_ID)))
    });

    // stable memory for storing all messages (alternative)
    pub static MESSAGE_ALT_MAP: RefCell<StableBTreeMap<StableMessageIdAlt, StableMessageAlt, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(MESSAGE_MEMORY_ALT_ID)))
    });

    //
    // Archive Stable Memory
    //

    // stable memory for storing Kong settings archive
    pub static KONG_SETTINGS_ARCHIVE: RefCell<StableCell<StableKongSettings, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableCell::init(memory_manager.get(KONG_SETTINGS_ARCHIVE_ID), StableKongSettings::default()).expect("Failed to initialize Kong settings"))
    });

    // stable memory for storing user archive
    pub static USER_ARCHIVE_MAP: RefCell<StableBTreeMap<StableUserId, StableUser, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(USER_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing token archive
    pub static TOKEN_ARCHIVE_MAP: RefCell<StableBTreeMap<StableTokenId, StableToken, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TOKEN_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing pools archive
    pub static POOL_ARCHIVE_MAP: RefCell<StableBTreeMap<StablePoolId, StablePool, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(POOL_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing tx archive
    pub static TX_ARCHIVE_MAP: RefCell<StableBTreeMap<StableTxId, StableTx, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing request archive
    pub static REQUEST_ARCHIVE_MAP: RefCell<StableBTreeMap<StableRequestId, StableRequest, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(REQUEST_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing transfer archive
    pub static TRANSFER_ARCHIVE_MAP: RefCell<StableBTreeMap<StableTransferId, StableTransfer, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TRANSFER_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing claim archive
    pub static CLAIM_ARCHIVE_MAP: RefCell<StableBTreeMap<StableClaimId, StableClaim, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(CLAIM_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing LP token ledger archive
    pub static LP_TOKEN_LEDGER_ARCHIVE: RefCell<StableBTreeMap<StableLPTokenLedgerId, StableLPTokenLedger, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(LP_TOKEN_LEDGER_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing message archive
    pub static MESSAGE_ARCHIVE_MAP: RefCell<StableBTreeMap<StableMessageId, StableMessage, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(MESSAGE_MEMORY_ARCHIVE_ID)))
    });

    //
    // Additional Stable Memory
    //

    // stable memory for storing txs for the last 24 hours. used for calculating rolling stats
    pub static TX_24H_MAP: RefCell<StableBTreeMap<StableTxId, StableTx, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_MEMORY_24H_ID)))
    });

    // static memory for storing transfers for the last 1 hour. used for preventing double receive
    pub static TRANSFER_1H_MAP: RefCell<StableBTreeMap<StableTransferId, StableTransfer, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TRANSFER_MEMORY_1H_ID)))
    });
}

/// A helper function to access the memory manager.
fn with_memory_manager<R>(f: impl FnOnce(&MemoryManager<DefaultMemoryImpl>) -> R) -> R {
    MEMORY_MANAGER.with(|cell| f(&cell.borrow()))
}
