use candid::{CandidType, Nat};
use ic_cdk::{init, post_upgrade, pre_upgrade, query, update};
use ic_cdk_timers::{clear_timer, set_timer_interval};
use ic_stable_structures::Memory as DefaultMemoryTrait;
use icrc_ledger_types::icrc21::errors::ErrorInfo;
use icrc_ledger_types::icrc21::requests::DisplayMessageType::{GenericDisplay, LineDisplay};
use icrc_ledger_types::icrc21::requests::{ConsentMessageMetadata, ConsentMessageRequest};
use icrc_ledger_types::icrc21::responses::{ConsentInfo, ConsentMessage, LineDisplayPage};
use itertools::Itertools;
use serde::Deserialize;
use std::time::Duration;

use super::stable_memory::with_memory_manager;
use super::stable_memory::{
    CLAIMS_TIMER_ID, MESSAGE_MAP, MESSAGE_MEMORY_ID, REQUEST_MAP_ARCHIVE_TIMER_ID, STATS_TIMER_ID, TRANSFER_MAP_ARCHIVE_TIMER_ID,
    TX_MAP_ARCHIVE_TIMER_ID,
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
use crate::ic::canister_address::KONG_BACKEND;
use crate::ic::logging::info_log;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_pool::pool_stats::update_pool_stats;
use crate::stable_request::request_archive::archive_request_map;
use crate::stable_transfer::transfer_archive::archive_transfer_map;
use crate::stable_tx::tx_archive::archive_tx_map;
use crate::stable_user::principal_id_map::create_principal_id_map;

#[init]
async fn init() {
    info_log(&format!("{} canister has been initialized", APP_NAME));

    create_principal_id_map();

    // start the background timer to process claims
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings_map::get().claims_interval_secs), || {
        ic_cdk::spawn(async {
            process_claims().await;
        });
    });
    CLAIMS_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to process stats
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings_map::get().stats_interval_secs), || {
        ic_cdk::spawn(async {
            _ = update_pool_stats();
        });
    });
    STATS_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive tx map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings_map::get().txs_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_tx_map(); // archive transaction map
        });
    });
    TX_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive request map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings_map::get().requests_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_request_map();
        });
    });
    REQUEST_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive transfer map
    let timer_id = set_timer_interval(
        Duration::from_secs(kong_settings_map::get().transfers_archive_interval_secs),
        || {
            ic_cdk::spawn(async {
                archive_transfer_map();
            });
        },
    );
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
    create_principal_id_map();

    // start the background timer to process claims
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings_map::get().claims_interval_secs), || {
        ic_cdk::spawn(async {
            process_claims().await;
        });
    });
    CLAIMS_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to process stats
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings_map::get().stats_interval_secs), || {
        ic_cdk::spawn(async {
            _ = update_pool_stats();
        });
    });
    STATS_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive tx map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings_map::get().txs_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_tx_map();
        });
    });
    TX_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive request map
    let timer_id = set_timer_interval(Duration::from_secs(kong_settings_map::get().requests_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_request_map();
        });
    });
    REQUEST_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    // start the background timer to archive transfer map
    let timer_id = set_timer_interval(
        Duration::from_secs(kong_settings_map::get().transfers_archive_interval_secs),
        || {
            ic_cdk::spawn(async {
                archive_transfer_map();
            });
        },
    );
    TRANSFER_MAP_ARCHIVE_TIMER_ID.with(|cell| cell.set(timer_id));

    MESSAGE_MAP.with(|cell| {
        cell.borrow_mut().clear_new();
    });
    with_memory_manager(|memory_manager| {
        let memory = memory_manager.get(MESSAGE_MEMORY_ID);
        if memory.size() > 0 {
            memory.write(0, &[0]);
        }
    });

    info_log(&format!("{} canister is upgraded", APP_NAME));
}

#[query]
fn icrc1_name() -> String {
    format!("{} {}", APP_NAME, APP_VERSION)
}

#[derive(CandidType, Deserialize, Eq, PartialEq, Debug)]
pub struct SupportedStandard {
    pub url: String,
    pub name: String,
}

#[query]
fn icrc10_supported_standards() -> Vec<SupportedStandard> {
    vec![
        SupportedStandard {
            url: "https://github.com/dfinity/ICRC/blob/main/ICRCs/ICRC-10/ICRC-10.md".to_string(),
            name: "ICRC-10".to_string(),
        },
        SupportedStandard {
            url: "https://github.com/dfinity/wg-identity-authentication/blob/main/topics/ICRC-21/icrc_21_consent_msg.md".to_string(),
            name: "ICRC-21".to_string(),
        },
        SupportedStandard {
            url: "https://github.com/dfinity/wg-identity-authentication/blob/main/topics/icrc_28_trusted_origins.md".to_string(),
            name: "ICRC-28".to_string(),
        },
    ]
}

#[update]
fn icrc21_canister_call_consent_message(consent_msg_request: ConsentMessageRequest) -> Result<ConsentInfo, ErrorInfo> {
    let metadata = ConsentMessageMetadata {
        language: "en".to_string(),
        utc_offset_minutes: None,
    };

    match consent_msg_request.user_preferences.device_spec {
        Some(LineDisplay {
            #[allow(unused_variables)]
            characters_per_line,
            lines_per_page,
        }) => {
            let mut lines = vec![];
            lines.push(format!("Approve canister to execute method {}", consent_msg_request.method));
            let pages = lines
                .into_iter()
                .chunks(lines_per_page as usize)
                .into_iter()
                .map(|page| LineDisplayPage { lines: page.collect() })
                .collect();
            Ok(ConsentInfo {
                metadata,
                consent_message: ConsentMessage::LineDisplayMessage { pages },
            })
        }
        Some(GenericDisplay) | None => Ok(ConsentInfo {
            metadata,
            consent_message: ConsentMessage::GenericDisplayMessage(format!(
                "Approve canister to execute method {}",
                consent_msg_request.method,
            )),
        }),
    }
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
        format!("https://edoy4-liaaa-aaaar-qakha-cai.localhost:5173"), // svelte FE
        #[cfg(not(feature = "prod"))]
        format!("http://localhost:5173"),
        #[cfg(feature = "prod")]
        String::from("https://kongswap.io"),
        #[cfg(feature = "prod")]
        String::from("https://www.kongswap.io"),
        #[cfg(feature = "prod")]
        String::from("https://edoy4-liaaa-aaaar-qakha-cai.icp0.io"),
        #[cfg(feature = "prod")]
        String::from("https://dev.kongswap.io"),
    ];

    Icrc28TrustedOriginsResponse { trusted_origins }
}

ic_cdk::export_candid!();
