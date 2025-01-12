use candid::{decode_one, CandidType, Nat};
use ic_cdk::{init, post_upgrade, pre_upgrade, query, update};
use ic_cdk_timers::set_timer_interval;
use icrc_ledger_types::icrc21::errors::ErrorInfo;
use icrc_ledger_types::icrc21::requests::DisplayMessageType::{GenericDisplay, LineDisplay};
use icrc_ledger_types::icrc21::requests::{ConsentMessageMetadata, ConsentMessageRequest};
use icrc_ledger_types::icrc21::responses::{ConsentInfo, ConsentMessage, LineDisplayPage};

use itertools::Itertools;
use serde::Deserialize;
use std::time::Duration;

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
use crate::swap::swap_args::SwapArgs;

#[init]
async fn init() {
    info_log(&format!("{} canister has been initialized", APP_NAME));

    create_principal_id_map();

    // start the background timer to process claims
    _ = set_timer_interval(Duration::from_secs(kong_settings_map::get().claims_interval_secs), || {
        ic_cdk::spawn(async {
            process_claims().await;
        });
    });

    // start the background timer to process stats
    _ = set_timer_interval(Duration::from_secs(kong_settings_map::get().stats_interval_secs), || {
        ic_cdk::spawn(async {
            _ = update_pool_stats();
        });
    });

    // start the background timer to archive tx map
    _ = set_timer_interval(Duration::from_secs(kong_settings_map::get().txs_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_tx_map(); // archive transaction map
        });
    });

    // start the background timer to archive request map
    _ = set_timer_interval(Duration::from_secs(kong_settings_map::get().requests_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_request_map();
        });
    });

    // start the background timer to archive transfer map
    _ = set_timer_interval(
        Duration::from_secs(kong_settings_map::get().transfers_archive_interval_secs),
        || {
            ic_cdk::spawn(async {
                archive_transfer_map();
            });
        },
    );
}

#[pre_upgrade]
fn pre_upgrade() {
    info_log(&format!("{} canister is upgrading", APP_NAME));
}

#[post_upgrade]
async fn post_upgrade() {
    create_principal_id_map();

    // start the background timer to process claims
    _ = set_timer_interval(Duration::from_secs(kong_settings_map::get().claims_interval_secs), || {
        ic_cdk::spawn(async {
            process_claims().await;
        });
    });

    // start the background timer to process stats
    _ = set_timer_interval(Duration::from_secs(kong_settings_map::get().stats_interval_secs), || {
        ic_cdk::spawn(async {
            _ = update_pool_stats();
        });
    });

    // start the background timer to archive tx map
    _ = set_timer_interval(Duration::from_secs(kong_settings_map::get().txs_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_tx_map();
        });
    });

    // start the background timer to archive request map
    _ = set_timer_interval(Duration::from_secs(kong_settings_map::get().requests_archive_interval_secs), || {
        ic_cdk::spawn(async {
            archive_request_map();
        });
    });

    // start the background timer to archive transfer map
    _ = set_timer_interval(
        Duration::from_secs(kong_settings_map::get().transfers_archive_interval_secs),
        || {
            ic_cdk::spawn(async {
                archive_transfer_map();
            });
        },
    );

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
    let consent_message = match consent_msg_request.method.as_str() {
        "swap" | "swap_async" => {
            let Ok(swap_args) = decode_one::<SwapArgs>(&consent_msg_request.arg) else {
                Err(ErrorInfo {
                    description: "Failed to decode SwapArgs".to_string(),
                })?
            };
            match consent_msg_request.user_preferences.device_spec {
                Some(LineDisplay {
                    characters_per_line: _characters_per_line,
                    lines_per_page,
                }) => {
                    let mut lines = vec!["Approve KongSwap to swap".to_string()];
                    lines.push(format!("{} {} for", swap_args.pay_amount, swap_args.pay_token));
                    lines.push(swap_args.receive_token);
                    let pages = lines
                        .into_iter()
                        .chunks(lines_per_page as usize)
                        .into_iter()
                        .map(|page| LineDisplayPage { lines: page.collect() })
                        .collect();
                    ConsentMessage::LineDisplayMessage { pages }
                }
                Some(GenericDisplay) | None => ConsentMessage::GenericDisplayMessage(format!(
                    "Approve KongSwap to swap {} {} for {}",
                    swap_args.pay_amount, swap_args.pay_token, swap_args.receive_token
                )),
            }
        }
        "add_liqudity" | "add_liquidity_async" => {
            let Ok(add_liquidity_args) = decode_one::<AddLiquidityArgs>(&consent_msg_request.arg) else {
                Err(ErrorInfo {
                    description: "Failed to decode AddLiquidityArgs".to_string(),
                })?
            };
            match consent_msg_request.user_preferences.device_spec {
                Some(LineDisplay {
                    characters_per_line: _characters_per_line,
                    lines_per_page,
                }) => {
                    let mut lines = vec!["Approve KongSwap to add liquidity".to_string()];
                    lines.push(format!("{} {} and", add_liquidity_args.amount_0, add_liquidity_args.token_0));
                    lines.push(format!("{} {}", add_liquidity_args.amount_1, add_liquidity_args.token_1));
                    let pages = lines
                        .into_iter()
                        .chunks(lines_per_page as usize)
                        .into_iter()
                        .map(|page| LineDisplayPage { lines: page.collect() })
                        .collect();
                    ConsentMessage::LineDisplayMessage { pages }
                }
                Some(GenericDisplay) | None => ConsentMessage::GenericDisplayMessage(format!(
                    "Approve KongSwap to add liquidity {} {} and {} {}",
                    add_liquidity_args.amount_0, add_liquidity_args.token_0, add_liquidity_args.amount_1, add_liquidity_args.token_1
                )),
            }
        }
        "add_pool" => {
            let Ok(add_pool_args) = decode_one::<AddPoolArgs>(&consent_msg_request.arg) else {
                Err(ErrorInfo {
                    description: "Failed to decode AddPoolArgs".to_string(),
                })?
            };
            match consent_msg_request.user_preferences.device_spec {
                Some(LineDisplay {
                    characters_per_line: _characters_per_line,
                    lines_per_page,
                }) => {
                    let mut lines = vec!["Approve KongSwap to add pool".to_string()];
                    lines.push(format!("{} {} and", add_pool_args.amount_0, add_pool_args.token_0));
                    lines.push(format!("{} {}", add_pool_args.amount_1, add_pool_args.token_1));
                    let pages = lines
                        .into_iter()
                        .chunks(lines_per_page as usize)
                        .into_iter()
                        .map(|page| LineDisplayPage { lines: page.collect() })
                        .collect();
                    ConsentMessage::LineDisplayMessage { pages }
                }
                Some(GenericDisplay) | None => ConsentMessage::GenericDisplayMessage(format!(
                    "Approve KongSwap to add pool {} {} and {} {}",
                    add_pool_args.amount_0, add_pool_args.token_0, add_pool_args.amount_1, add_pool_args.token_1
                )),
            }
        }
        _ => match consent_msg_request.user_preferences.device_spec {
            Some(LineDisplay {
                characters_per_line: _characters_per_line,
                lines_per_page,
            }) => {
                let mut lines = vec![];
                lines.push(format!("Approve KongSwap to execute {}", consent_msg_request.method));
                let pages = lines
                    .into_iter()
                    .chunks(lines_per_page as usize)
                    .into_iter()
                    .map(|page| LineDisplayPage { lines: page.collect() })
                    .collect();
                ConsentMessage::LineDisplayMessage { pages }
            }
            Some(GenericDisplay) | None => {
                ConsentMessage::GenericDisplayMessage(format!("Approve KongSwap to execute {}", consent_msg_request.method))
            }
        },
    };

    let metadata = ConsentMessageMetadata {
        language: "en".to_string(),
        utc_offset_minutes: None,
    };

    Ok(ConsentInfo { metadata, consent_message })
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
