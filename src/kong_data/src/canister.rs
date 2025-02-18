use candid::CandidType;
use ic_cdk::api::call::{accept_message, method_name};
use ic_cdk::{init, post_upgrade, pre_upgrade, query, update};
use ic_cdk_macros::inspect_message;
use serde::Deserialize;

use crate::ic::id::caller_principal_id;
use crate::ic::logging::info_log;
use crate::stable_user::principal_id_map::create_principal_id_map;

use super::{APP_NAME, APP_VERSION};

// list of query calls
// a bit hard-coded but shouldn't change often
static QUERY_METHODS: [&str; 5] = ["icrc1_name", "icrc10_supported_standards", "tokens", "pools", "txs"];

#[init]
async fn init() {
    info_log(&format!("{} canister has been initialized", APP_NAME));

    create_principal_id_map();
}

#[pre_upgrade]
fn pre_upgrade() {
    info_log(&format!("{} canister is upgrading", APP_NAME));
}

#[post_upgrade]
async fn post_upgrade() {
    create_principal_id_map();

    info_log(&format!("{} canister is upgraded", APP_NAME));
}

/// inspect all ingress messages to the canister that are called as updates
/// calling accept_message() will allow the message to be processed
#[inspect_message]
fn inspect_message() {
    let method_name = method_name();
    if QUERY_METHODS.contains(&method_name.as_str()) {
        info_log(&format!("{} called as update from {}", method_name, caller_principal_id()));
        ic_cdk::trap(&format!("{} must be called as query", method_name));
    }

    accept_message();
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
            url: "https://github.com/dfinity/wg-identity-authentication/blob/main/topics/icrc_28_trusted_origins.md".to_string(),
            name: "ICRC-28".to_string(),
        },
    ]
}

#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct Icrc28TrustedOriginsResponse {
    pub trusted_origins: Vec<String>,
}

// list every base URL that users will authenticate to your app from
#[update]
fn icrc28_trusted_origins() -> Icrc28TrustedOriginsResponse {
    let trusted_origins = vec![
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
