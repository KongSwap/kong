use anyhow::Result;
use candid::Principal;
use pocket_ic::PocketIc;

use crate::common::identity::get_identity_from_pem_file;
// Import both helpers, the original and the one for specific ID
use crate::common::kong_backend::{create_kong_backend, create_kong_backend_at_id};

pub const CONTROLLER_PEM_FILE: &str = "tests/common/identity.pem";

pub fn setup_ic_environment() -> Result<(PocketIc, Principal)> {
    // setup pocket-ic
    let ic = PocketIc::new();

    // setup identity
    let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE).expect("Failed to get controller identity");
    let controller_principal_id = controller_identity.sender().expect("Failed to get controller principal id");

    // Define the specific principal ID for Kong backend
    let specific_kong_id = Principal::from_text("2ipq2-uqaaa-aaaar-qailq-cai")
        .expect("Invalid Kong Principal ID text");

    // deploy canisters using the specific ID
    // Map the String error from the helper to anyhow::Error for the `?` operator
    let kong_backend = create_kong_backend_at_id(
        &ic,
        specific_kong_id,
        controller_principal_id,
        // Init args still `()`
    )
    .map_err(|e| anyhow::anyhow!(e))?; // Map String error to anyhow::Error

    Ok((ic, kong_backend))
}
