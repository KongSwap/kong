use anyhow::Result;
use candid::Principal;
use pocket_ic::PocketIc;
use std::str::FromStr;

use crate::common::identity::get_new_identity;
use crate::common::kong_backend::create_kong_backend;

// Mainnet KONG_BACKEND ID from src/kong_backend/src/ic/canister_address.rs
const KONG_BACKEND_MAINNET_ID: &str = "2ipq2-uqaaa-aaaar-qailq-cai";

pub fn setup_ic_environment() -> Result<(PocketIc, Principal)> {
    // setup pocket-ic
    let ic = PocketIc::new();

    // Create a new random identity
    let controller_identity = get_new_identity().expect("Failed to create controller identity");
    let controller_principal_id = controller_identity.sender().expect("Failed to get controller principal id");

    // Define the specific Principal ID for kong_backend
    let kong_backend_id =
        Principal::from_str(KONG_BACKEND_MAINNET_ID).expect("Failed to parse KONG_BACKEND_MAINNET_ID");

    // deploy canisters
    let kong_backend_principal =
        create_kong_backend(&ic, &Some(controller_principal_id), Some(kong_backend_id))?;

    Ok((ic, kong_backend_principal))
}
