use anyhow::Result;
use candid::Principal;
use pocket_ic::PocketIc;

use crate::common::identity::get_new_identity;
use crate::common::kong_backend::create_kong_backend;

pub fn setup_ic_environment() -> Result<(PocketIc, Principal)> {
    // setup pocket-ic
    let ic = PocketIc::new();

    // Create a new random identity
    let controller_identity = get_new_identity().expect("Failed to create controller identity");
    let controller_principal_id = controller_identity.sender().expect("Failed to get controller principal id");

    // deploy canisters
    let kong_backend = create_kong_backend(&ic, &Some(controller_principal_id))?;

    Ok((ic, kong_backend))
}
