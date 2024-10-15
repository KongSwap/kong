use candid::Nat;
use ic_cdk::{init, post_upgrade, pre_upgrade, query};
use ic_cdk_timers::{clear_timer, set_timer_interval, TimerId};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell};
use std::{
    cell::{Cell, RefCell},
    time::Duration,
};

use crate::add_liquidity::add_liquidity_args::AddLiquidityArgs;
use crate::add_liquidity::add_liquidity_reply::AddLiquidityReply;
use crate::add_liquidity_amounts::add_liquidity_amounts_reply::AddLiquidityAmountsReply;
use crate::add_pool::add_pool_args::AddPoolArgs;
use crate::add_pool::add_pool_reply::AddPoolReply;
use crate::add_token::add_token_args::AddTokenArgs;
use crate::add_token::add_token_reply::AddTokenReply;
use crate::canister::logging::info_log;
use crate::claims::claims::process_claims;
use crate::messages::message_reply::MessagesReply;
use crate::pools::pools_reply::PoolsReply;
use crate::remove_liquidity::remove_liquidity_args::RemoveLiquidityArgs;
use crate::remove_liquidity::remove_liquidity_reply::RemoveLiquidityReply;
use crate::remove_liquidity_amounts::remove_liquidity_amounts_reply::RemoveLiquidityAmountsReply;
use crate::requests::request_reply::RequestReply;
use crate::send::send_args::SendArgs;
use crate::send::send_reply::SendReply;
use crate::stable_claim::stable_claim::{StableClaim, StableClaimId};
use crate::stable_kong_settings::kong_settings;
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_lp_token_ledger::lp_token_ledger_archive::archive_lp_token_ledger;
use crate::stable_lp_token_ledger::stable_lp_token_ledger::{StableLPTokenLedger, StableLPTokenLedgerId};
use crate::stable_message::stable_message::{StableMessage, StableMessageId};
use crate::stable_pool::pool_stats::update_pool_stats;
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_pool::stable_pool_v2::StablePoolV2;
use crate::stable_request::request_archive::archive_request_map;
use crate::stable_request::stable_request::{StableRequest, StableRequestId};
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use crate::stable_transfer::transfer_archive::archive_transfer_map;
use crate::stable_tx::stable_tx::{StableTx, StableTxId};
use crate::stable_tx::tx_archive::archive_tx_map;
use crate::stable_user::stable_user::{StableUser, StableUserId};
use crate::swap::swap_args::SwapArgs;
use crate::swap::swap_reply::SwapReply;
use crate::swap_amounts::swap_amounts_reply::SwapAmountsReply;
use crate::tokens::tokens_reply::TokensReply;
use crate::txs::txs_reply::TxsReply;
use crate::user::user_reply::UserReply;
use crate::user_balances::user_balances_reply::UserBalancesReply;

mod add_liquidity;
mod add_liquidity_amounts;
mod add_pool;
mod add_token;
mod canister;
mod chains;
mod claims;
mod helpers;
mod messages;
mod pools;
mod remove_liquidity;
mod remove_liquidity_amounts;
mod requests;
mod send;
mod stable_claim;
mod stable_kong_settings;
mod stable_lp_token_ledger;
mod stable_message;
mod stable_pool;
mod stable_request;
mod stable_token;
mod stable_transfer;
mod stable_tx;
mod stable_user;
mod swap;
mod swap_amounts;
mod tokens;
mod transfers;
mod txs;
mod user;
mod user_balances;

pub const APP_NAME: &str = "Kong Swap";
pub const APP_VERSION: &str = "v0.0.8";

type Memory = VirtualMemory<DefaultMemoryImpl>;

const KONG_SETTINGS_ID: MemoryId = MemoryId::new(0);
const USER_MEMORY_ID: MemoryId = MemoryId::new(1);
const TOKEN_MEMORY_ID: MemoryId = MemoryId::new(2);
const POOL_MEMORY_ID: MemoryId = MemoryId::new(3);
const TX_MEMORY_ID: MemoryId = MemoryId::new(4);
const REQUEST_MEMORY_ID: MemoryId = MemoryId::new(5);
const TRANSFER_MEMORY_ID: MemoryId = MemoryId::new(6);
const CLAIM_MEMORY_ID: MemoryId = MemoryId::new(7);
const LP_TOKEN_LEDGER_MEMORY_ID: MemoryId = MemoryId::new(8);
const MESSAGE_MEMORY_ID: MemoryId = MemoryId::new(9);
// archive memories
const POOL_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(103);
const TX_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(104);
const REQUEST_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(105);
const TRANSFER_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(106);
const LP_TOKEN_LEDGER_MEMORY_ARCHIVE_ID: MemoryId = MemoryId::new(108);

thread_local! {
    // static variable to store the timer id for the background claims timer
    // doesn't need to be in stable memory as they are not persisted across upgrades
    static CLAIMS_TIMER_ID: Cell<TimerId> = Cell::default();

    // static variable to store the timer id for the background stats timer
    static STATS_TIMER_ID: Cell<TimerId> = Cell::default();

    // static variable to store the timer id for the background tx map archive timer
    static TX_MAP_ARCHIVE_TIMER_ID: Cell<TimerId> = Cell::default();

    // static variable to store the timer id for the background request map archive timer
    static REQUEST_MAP_ARCHIVE_TIMER_ID: Cell<TimerId> = Cell::default();

    // static variable to store the timer id for the background transfer archive timer
    static TRANSFER_MAP_ARCHIVE_TIMER_ID: Cell<TimerId> = Cell::default();

    // static variable to store the timer id for the background LP token ledger archive timer
    static LP_TOKEN_LEDGER_ARCHIVE_TIMER_ID: Cell<TimerId> = Cell::default();

    // MEMORY_MANAGER is given management of the entire stable memory. Given a 'MemoryId', it can
    // return a memory that can be used by stable structures
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // stable memory for storing Kong settings
    static KONG_SETTINGS: RefCell<StableCell<StableKongSettings, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableCell::init(memory_manager.get(KONG_SETTINGS_ID), StableKongSettings::default()).expect("Failed to initialize Kong settings"))
    });

    // stable memory for storing user profiles
    static USER_MAP: RefCell<StableBTreeMap<StableUserId, StableUser, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(USER_MEMORY_ID)))
    });

    // stable memory for storing tokens supported by the system
    static TOKEN_MAP: RefCell<StableBTreeMap<StableTokenId, StableToken, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TOKEN_MEMORY_ID)))
    });

    // stable memory for storing pools
    static POOL_MAP: RefCell<StableBTreeMap<StablePoolId, StablePool, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(POOL_MEMORY_ID)))
    });

    // stable memory for storing all transactions
    static TX_MAP: RefCell<StableBTreeMap<StableTxId, StableTx, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_MEMORY_ID)))
    });

    // stable memory for storing all requests made by users
    static REQUEST_MAP: RefCell<StableBTreeMap<StableRequestId, StableRequest, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(REQUEST_MEMORY_ID)))
    });

    // stable memory for storing all on-chain transfers with block_id. used to prevent accepting transfer twice (double receive)
    static TRANSFER_MAP: RefCell<StableBTreeMap<StableTransferId, StableTransfer, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TRANSFER_MEMORY_ID)))
    });

    // stable memory for storing all claims for users
    static CLAIM_MAP: RefCell<StableBTreeMap<StableClaimId, StableClaim, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(CLAIM_MEMORY_ID)))
    });

    // stable memory for storing all LP tokens for users
    static LP_TOKEN_LEDGER: RefCell<StableBTreeMap<StableLPTokenLedgerId, StableLPTokenLedger, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(LP_TOKEN_LEDGER_MEMORY_ID)))
    });

    // stable memory for storing all messages
    static MESSAGE_MAP: RefCell<StableBTreeMap<StableMessageId, StableMessage, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(MESSAGE_MEMORY_ID)))
    });

    // stable memory for storing pools backup
    static POOL_TMP_MAP: RefCell<StableBTreeMap<StablePoolId, StablePoolV2, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(POOL_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing tx archive
    static TX_ARCHIVE_MAP: RefCell<StableBTreeMap<StableTxId, StableTx, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TX_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing request archive
    static REQUEST_ARCHIVE_MAP: RefCell<StableBTreeMap<StableRequestId, StableRequest, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(REQUEST_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing transfer archive
    static TRANSFER_ARCHIVE_MAP: RefCell<StableBTreeMap<StableTransferId, StableTransfer, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TRANSFER_MEMORY_ARCHIVE_ID)))
    });

    // stable memory for storing LP token ledger archive
    static LP_TOKEN_LEDGER_ARCHIVE: RefCell<StableBTreeMap<StableLPTokenLedgerId, StableLPTokenLedger, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(LP_TOKEN_LEDGER_MEMORY_ARCHIVE_ID)))
    });
}

/// A helper function to access the memory manager.
fn with_memory_manager<R>(f: impl FnOnce(&MemoryManager<DefaultMemoryImpl>) -> R) -> R {
    MEMORY_MANAGER.with(|cell| f(&cell.borrow()))
}

#[init]
async fn init() {
    info_log(&format!("{} canister has been initialized", APP_NAME));

    // set the Kong backend id
    kong_settings::set_kong_backend_id().unwrap_or_else(|e| {
        panic!("Failed to set Kong backend id: {}", e);
    });

    info_log(&format!("Kong backend id: {}", kong_settings::get().kong_backend_id));
    info_log(&format!("Kong maintenance mode: {}", kong_settings::get().maintenance_mode));

    // start the background timer to process claims
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().claims_interval_secs), || {
        ic_cdk::spawn(async {
            process_claims().await;
        });
    });
    CLAIMS_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to process stats
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().stats_interval_secs), || {
        ic_cdk::spawn(async {
            update_pool_stats();
        });
    });
    STATS_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive tx map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().txs_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_tx_map();
        });
    });
    TX_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive request map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().requests_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_request_map();
        });
    });
    REQUEST_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive transfer map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().transfers_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_transfer_map();
        });
    });
    TRANSFER_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive LP token ledger
    let timer_id = set_timer_interval(
        Duration::from_secs(kong_settings::get().lp_token_ledger_archive_interval_secs),
        || {
            ic_cdk::spawn(async {
                archive_lp_token_ledger();
            });
        },
    );
    LP_TOKEN_LEDGER_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));
}

#[pre_upgrade]
fn pre_upgrade() {
    info_log(&format!("{} canister is upgrading", APP_NAME));

    // clear the background timer for processing claims
    CLAIMS_TIMER_ID.with(|cell| clear_timer(cell.get()));

    // clear the background timer for processing stats
    STATS_TIMER_ID.with(|cell| clear_timer(cell.get()));

    // clear the background timer for archiving tx map
    TX_MAP_ARCHIVE_TIMER_ID.with(|cell| clear_timer(cell.get()));

    // clear the background timer for archiving request map
    REQUEST_MAP_ARCHIVE_TIMER_ID.with(|cell| clear_timer(cell.get()));

    // clear the background timer for archiving transfer map
    TRANSFER_MAP_ARCHIVE_TIMER_ID.with(|cell| clear_timer(cell.get()));

    // clear the background timer for archiving LP token ledger
    LP_TOKEN_LEDGER_ARCHIVE_TIMER_ID.with(|cell| clear_timer(cell.get()));
}

#[post_upgrade]
async fn post_upgrade() {
    // start the background timer to process claims
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().claims_interval_secs), || {
        ic_cdk::spawn(async {
            process_claims().await;
        });
    });
    CLAIMS_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to process stats
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().stats_interval_secs), || {
        ic_cdk::spawn(async {
            update_pool_stats();
        });
    });
    STATS_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive tx map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().txs_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_tx_map();
        });
    });
    TX_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive request map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().requests_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_request_map();
        });
    });
    REQUEST_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive transfer map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings::get().transfers_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_transfer_map();
        });
    });
    TRANSFER_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive LP token ledger
    let timer_id = set_timer_interval(
        Duration::from_secs(kong_settings::get().lp_token_ledger_archive_interval_secs),
        || {
            ic_cdk::spawn(async {
                archive_lp_token_ledger();
            });
        },
    );
    LP_TOKEN_LEDGER_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    info_log(&format!("{} canister is upgraded", APP_NAME));
}

#[query]
fn icrc1_name() -> String {
    format!("{} {}", APP_NAME, APP_VERSION)
}

ic_cdk::export_candid!();
