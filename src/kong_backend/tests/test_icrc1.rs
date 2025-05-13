pub mod common;

use candid::{decode_one, encode_one, Principal};
use kong_backend::{APP_NAME, APP_VERSION};

use common::setup::setup_ic_environment;

#[test]
fn test_icrc1_name() {
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    let args = encode_one(()).expect("Failed to encode arguments for icrc1_name");
    let Ok(response) = ic.query_call(kong_backend, Principal::anonymous(), "icrc1_name", args) else {
        panic!("Failed to query icrc1_name");
    };
    let result = decode_one::<String>(&response).expect("Failed to decode icrc1_name response");

    let expected_icrc1_name = format!("{} {}", APP_NAME, APP_VERSION);
    assert_eq!(result, expected_icrc1_name, "icrc1_name should be to '{}'", expected_icrc1_name);
}
