use anyhow::Result;
use candid::{encode_one, Principal};
use pocket_ic::PocketIc;
use std::fs;

use crate::common::canister::{create_canister, create_canister_with_id}; // Import necessary helper

const KONG_BACKEND_WASM: &str = "../../target/wasm32-unknown-unknown/release/kong_backend.wasm";

pub fn create_kong_backend(ic: &PocketIc, controller: &Option<Principal>) -> Result<Principal> {
    let kong_backend = create_canister(ic, controller, &None);
    let wasm_module = fs::read(KONG_BACKEND_WASM)?;
    let args = encode_one(())?;
    ic.install_canister(kong_backend, wasm_module, args, *controller);
    Ok(kong_backend)
}

/// Creates the Kong backend canister with a specified ID and controller.
pub fn create_kong_backend_with_id(
    ic: &PocketIc,
    canister_id: Principal,
    controller: Principal, // Controller for the new canister
                           // Assuming Kong init args are still unit `()` for now based on create_kong_backend
) -> Result<Principal> {
    // 1. Create the canister shell with the specified ID
    // Note: create_canister_at_id already adds cycles
    let kong_canister_id = create_canister_with_id(ic, canister_id, controller)?;

    // 2. Read the Wasm module
    let wasm_module = fs::read(KONG_BACKEND_WASM)?;

    // 3. Encode the init arguments (currently unit `()`)
    let args = encode_one(())?;

    // 4. Install the Wasm onto the specified canister ID
    // `install_canister` takes sender: Option<Principal>
    ic.install_canister(kong_canister_id, wasm_module, args, Some(controller)); // Use controller as sender for install

    Ok(kong_canister_id)
}
