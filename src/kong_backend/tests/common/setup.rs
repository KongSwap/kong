use anyhow::Result;
use candid::Principal;
use pocket_ic::PocketIc;

use crate::common::identity::get_identity_from_pem_file;
use crate::common::kong_backend::create_kong_backend;

pub const CONTROLLER_PEM_FILE: &str = "tests/common/identity.pem";

pub fn setup_ic_environment() -> Result<(PocketIc, Principal)> {
    // setup pocket-ic
    let ic = PocketIc::new();

    // setup identity
    let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE).expect("Failed to get controller identity");
    let controller_principal_id = controller_identity.sender().expect("Failed to get controller principal id");

    // deploy canisters
    let kong_backend = create_kong_backend(&ic, &Some(controller_principal_id))?;

    Ok((ic, kong_backend))
}
