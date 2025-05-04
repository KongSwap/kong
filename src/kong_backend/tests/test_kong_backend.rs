pub mod common;

use anyhow::Result;
use candid::{decode_one, encode_one, Principal};
use kong_backend::ic::get_time::get_time;
use pocket_ic::PocketIc;
use std::fs;

use common::canister::create_canister;
use common::identity;

const CONTROLLER_PEM_FILE: &str = "tests/common/identity.pem";
const KONG_BACKEND_WASM: &str = "../../target/wasm32-unknown-unknown/release/kong_backend.wasm";

fn setup_ic_environment() -> Result<(PocketIc, Principal)> {
    let ic = PocketIc::new();

    let controller_identity = identity::get_identity_from_pem_file(CONTROLLER_PEM_FILE).expect("Failed to get controller identity");
    let controller_principal_id = controller_identity.sender().expect("Failed to get controller principal id");
    let kong_backend = create_canister(&ic, &Some(controller_principal_id), &None);
    let kong_backend_wasm = fs::read(KONG_BACKEND_WASM).expect("Failed to read wasm file");
    let args = encode_one(()).expect("Failed to encode arguments");
    ic.install_canister(kong_backend, kong_backend_wasm, args, Some(controller_principal_id));

    Ok((ic, kong_backend))
}

#[test]
fn test_icrc1_name() {
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    let Ok(response) = ic.query_call(kong_backend, Principal::anonymous(), "icrc1_name", encode_one(()).unwrap()) else {
        panic!("Failed to query icrc1_name");
    };
    let result = decode_one::<String>(&response).expect("Failed to decode icrc1_name response");

    assert_eq!(result, "Kong Swap v0.0.20".to_string());
}
