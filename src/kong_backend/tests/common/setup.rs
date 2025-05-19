use anyhow::Result;
use candid::Principal;
use pocket_ic::{PocketIc, PocketIcBuilder};

use crate::common::identity::get_identity_from_pem_file;
// Import the helper for creating Kong backend at a specific ID
use crate::common::kong_backend::create_kong_backend_with_id;

pub const CONTROLLER_PEM_FILE: &str = "tests/common/identity.pem";

pub fn setup_ic_environment() -> Result<(PocketIc, Principal)> {
    // setup pocket-ic
    let ic = PocketIcBuilder::new()
        .with_system_subnet()
        .with_fiduciary_subnet()
        .with_application_subnet()
        .build();

    // setup identity
    let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE)?;
    let controller_principal_id = controller_identity.sender().expect("Failed to get controller principal id");

    // Define the specific principal ID for Kong backend
    let specific_kong_id = Principal::from_text("2ipq2-uqaaa-aaaar-qailq-cai")?;

    // deploy canisters using the specific ID
    // Map the String error from the helper to anyhow::Error for the `?` operator
    let kong_backend = create_kong_backend_with_id(
        &ic,
        specific_kong_id,
        controller_principal_id,
        // Init args still `()`
    )?;

    Ok((ic, kong_backend))
}
