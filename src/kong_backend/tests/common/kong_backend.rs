use anyhow::Result;
use candid::{encode_one, Principal};
use pocket_ic::PocketIc;
use std::fs;

use crate::common::canister::create_canister;

const KONG_BACKEND_WASM: &str = "../../target/wasm32-unknown-unknown/release/kong_backend.wasm";

pub fn create_kong_backend(
    ic: &PocketIc,
    controller: &Option<Principal>,
    canister_id: Option<Principal>,
) -> Result<Principal> {
    let kong_backend_principal = create_canister(ic, controller, &None, canister_id);
    let wasm_module = fs::read(KONG_BACKEND_WASM)?;
    let args = encode_one(())?;
    ic.install_canister(kong_backend_principal, wasm_module, args, *controller);
    Ok(kong_backend_principal)
}
