use ic_cdk::api::call::{accept_message, method_name};
use ic_cdk::{init, post_upgrade, pre_upgrade, query};
use ic_cdk_macros::inspect_message;

use kong_lib::ic::id::caller_principal_id;
use kong_lib::ic::logging::info_log;

use super::{APP_NAME, APP_VERSION};

static QUERY_METHODS: [&str; 1] = ["icrc1_name"];

#[init]
async fn init() {
    info_log(&format!("{} canister has been initialized", APP_NAME));
}

#[pre_upgrade]
fn pre_upgrade() {
    info_log(&format!("{} canister is being upgraded", APP_NAME));
}

#[post_upgrade]
async fn post_upgrade() {
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

ic_cdk::export_candid!();
