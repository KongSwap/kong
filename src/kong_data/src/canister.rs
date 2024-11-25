use crate::ic::logging::info_log;
use ic_cdk::{init, post_upgrade, pre_upgrade, query};

use super::{APP_NAME, APP_VERSION};

#[init]
async fn init() {
    info_log(&format!("{} canister has been initialized", APP_NAME));
}

#[pre_upgrade]
fn pre_upgrade() {
    info_log(&format!("{} canister is upgrading", APP_NAME));
}

#[post_upgrade]
async fn post_upgrade() {
    info_log(&format!("{} canister is upgraded", APP_NAME));
}

#[query]
fn icrc1_name() -> String {
    format!("{} {}", APP_NAME, APP_VERSION)
}

ic_cdk::export_candid!();
