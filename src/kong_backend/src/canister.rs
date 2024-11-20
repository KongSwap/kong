use candid::{CandidType, Nat};
use ic_cdk::{init, post_upgrade, pre_upgrade, query, update};
use ic_cdk_timers::{clear_timer, set_timer_interval};
use ic_stable_structures::Memory as DefaultMemoryTrait;
use serde::Deserialize;
use std::time::Duration;

use super::stable_memory::{
    CLAIMS_TIMER_ID, REQUEST_MAP_ARCHIVE_TIMER_ID, STATS_TIMER_ID, TRANSFER_MAP_ARCHIVE_TIMER_ID, TX_MAP_ARCHIVE_TIMER_ID,
};
use super::{APP_NAME, APP_VERSION};

use crate::add_liquidity::add_liquidity_args::AddLiquidityArgs;
use crate::add_liquidity::add_liquidity_reply::AddLiquidityReply;
use crate::add_liquidity_amounts::add_liquidity_amounts_reply::AddLiquidityAmountsReply;
use crate::add_pool::add_pool_args::AddPoolArgs;
use crate::add_pool::add_pool_reply::AddPoolReply;
use crate::add_token::add_token_args::AddTokenArgs;
use crate::add_token::add_token_reply::AddTokenReply;
use crate::claims::claims::process_claims;
use crate::controllers::claims::upgrade_claims;
use crate::controllers::kong_settings::upgrade_kong_settings;
use crate::controllers::lp_token_ledger::upgrade_lp_token_ledger;
use crate::controllers::messages::upgrade_messages;
use crate::controllers::pools::upgrade_pools;
use crate::controllers::requests::upgrade_requests;
use crate::controllers::tokens::upgrade_tokens;
use crate::controllers::transfers::upgrade_transfers;
use crate::controllers::txs::{upgrade_24h_txs, upgrade_txs};
use crate::controllers::users::upgrade_users;
use crate::ic::canister_address::KONG_BACKEND;
use crate::ic::logging::info_log;
use crate::stable_kong_settings::kong_settings;
use crate::stable_memory::{
    CLAIM_OLD_MAP, CLAIM_OLD_MEMORY_ID, KONG_SETTINGS_OLD_ID, MEMORY_MANAGER, MESSAGE_OLD_MAP, MESSAGE_OLD_MEMORY_ID, POOL_OLD_MAP,
    POOL_OLD_MEMORY_ID, TOKEN_OLD_MAP, TOKEN_OLD_MEMORY_ID, TX_24H_OLD_MAP, TX_24H_OLD_MEMORY_ID, TX_OLD_MAP, TX_OLD_MEMORY_ID,
};
use crate::stable_pool::pool_stats::update_pool_stats;
use crate::stable_request::request_archive::archive_request_map;
use crate::stable_transfer::transfer_archive::archive_transfer_map;
use crate::stable_tx::tx_archive::archive_tx_map;

#[init]
async fn init() {
    info_log(&format!("{} canister has been initialized", APP_NAME));

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
            archive_tx_map(); // archive transaction map
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

    /*
    _ = upgrade_24h_txs();
    info_log("24h transactions are upgraded");
    _ = upgrade_txs();
    info_log("Txs are upgraded");
    _ = upgrade_claims();
    info_log("Claims are upgraded");
    _ = upgrade_messages();
    info_log("Messages are upgraded");
    _ = upgrade_kong_settings();
    info_log("Kong settings are upgraded");
    _ = upgrade_tokens();
    info_log("Tokens are upgraded");
    _ = upgrade_pools();
    info_log("Pools are upgraded");
    */
    TX_24H_OLD_MAP.with(|m| {
        m.borrow_mut().clear_new();
    });
    MEMORY_MANAGER.with(|m| {
        let memory_manager = m.borrow();
        let mem = memory_manager.get(TX_24H_OLD_MEMORY_ID);
        if mem.size() > 0 {
            mem.write(0, &[0]);
        }
        info_log("24h transactions cleared");
    });

    TX_OLD_MAP.with(|m| {
        m.borrow_mut().clear_new();
    });
    MEMORY_MANAGER.with(|m| {
        let memory_manager = m.borrow();
        let mem = memory_manager.get(TX_OLD_MEMORY_ID);
        if mem.size() > 0 {
            mem.write(0, &[0]);
        }
        info_log("Txs cleared");
    });

    CLAIM_OLD_MAP.with(|m| {
        m.borrow_mut().clear_new();
    });
    MEMORY_MANAGER.with(|m| {
        let memory_manager = m.borrow();
        let mem = memory_manager.get(CLAIM_OLD_MEMORY_ID);
        if mem.size() > 0 {
            mem.write(0, &[0]);
        }
        info_log("Claims cleared");
    });

    MESSAGE_OLD_MAP.with(|m| {
        m.borrow_mut().clear_new();
    });
    MEMORY_MANAGER.with(|m| {
        let memory_manager = m.borrow();
        let mem = memory_manager.get(MESSAGE_OLD_MEMORY_ID);
        if mem.size() > 0 {
            mem.write(0, &[0]);
        }
        info_log("Messages cleared");
    });

    MEMORY_MANAGER.with(|m| {
        let memory_manager = m.borrow();
        let mem = memory_manager.get(KONG_SETTINGS_OLD_ID);
        if mem.size() > 0 {
            mem.write(0, &[0]);
        }
        info_log("Kong settings cleared");
    });

    TOKEN_OLD_MAP.with(|m| {
        m.borrow_mut().clear_new();
    });
    MEMORY_MANAGER.with(|m| {
        let memory_manager = m.borrow();
        let mem = memory_manager.get(TOKEN_OLD_MEMORY_ID);
        if mem.size() > 0 {
            mem.write(0, &[0]);
        }
        info_log("Tokens cleared");
    });

    POOL_OLD_MAP.with(|m| {
        m.borrow_mut().clear_new();
    });
    MEMORY_MANAGER.with(|m| {
        let memory_manager = m.borrow();
        let mem = memory_manager.get(POOL_OLD_MEMORY_ID);
        if mem.size() > 0 {
            mem.write(0, &[0]);
        }
        info_log("Pools cleared");
    });

    _ = upgrade_lp_token_ledger();
    info_log("LP token ledger is upgraded");
    _ = upgrade_users();
    info_log("Users are upgraded");
    _ = upgrade_requests();
    info_log("Requests are upgraded");
    _ = upgrade_transfers();
    info_log("Transfers are upgraded");

    info_log(&format!("{} canister is upgraded", APP_NAME));
}

#[query]
fn icrc1_name() -> String {
    format!("{} {}", APP_NAME, APP_VERSION)
}

#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct Icrc28TrustedOriginsResponse {
    pub trusted_origins: Vec<String>,
}

// list every base URL that users will authenticate to your app from
#[update]
fn icrc28_trusted_origins() -> Icrc28TrustedOriginsResponse {
    let trusted_origins = vec![
        format!("https://{}.icp0.io", KONG_BACKEND),
        #[cfg(not(feature = "prod"))]
        format!("http://{}.localhost:4943", KONG_BACKEND),
        #[cfg(not(feature = "prod"))]
        format!("http://edoy4-liaaa-aaaar-qakha-cai.localhost:5173"), // svelte FE
        #[cfg(not(feature = "prod"))]
        format!("http://edoy4-liaaa-aaaar-qakha-cai.icp0.io"), // svelte FE
        #[cfg(not(feature = "prod"))]
        format!("http://localhost:5173"),
        #[cfg(feature = "prod")]
        String::from("https://www.kongswap.io"),
        #[cfg(feature = "prod")]
        String::from("https://kongswap.io"),
    ];

    Icrc28TrustedOriginsResponse { trusted_origins }
}

ic_cdk::export_candid!();
