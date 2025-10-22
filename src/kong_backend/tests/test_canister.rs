pub mod common;

use candid::{decode_one, encode_one, Principal};
use kong_backend::canister::Icrc28TrustedOriginsResponse;

use common::setup::setup_ic_environment;

// Test for the `icrc28_trusted_origins` method in the Kong backend canister
// Be careful as this will depend if the wasm is "prod" build
#[test]
fn test_canister_icrc28() {
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    let args = encode_one(()).expect("Failed to encode arguments for tokens");
    let Ok(response) = ic.update_call(kong_backend, Principal::anonymous(), "icrc28_trusted_origins", args) else {
        panic!("Failed to update icrc28_trusted_origins");
    };
    let result = decode_one::<Icrc28TrustedOriginsResponse>(&response).expect("Failed to decode icrc28_trusted_origins response");

    // These should not be changed often. Should be alerted if they are changed.
    let expected_origins = [
        "https://2ipq2-uqaaa-aaaar-qailq-cai.icp0.io".to_string(),
        // not "prod"
        "http://2ipq2-uqaaa-aaaar-qailq-cai.localhost:8000".to_string(),
        "https://edoy4-liaaa-aaaar-qakha-cai.localhost:5173".to_string(),
        "http://localhost:5173".to_string(),
        // "prod"
        // "https://kongswap.io".to_string(),
        // "https://www.kongswap.io".to_string(),
        // "https://edoy4-liaaa-aaaar-qakha-cai.icp0.io".to_string(),
        // "https://dev.kongswap.io".to_string(),
    ];

    assert_eq!(
        result.trusted_origins.len(),
        expected_origins.len(),
        "icrc28_trusted_origins received {} entries, expected {}",
        result.trusted_origins.len(),
        expected_origins.len(),
    );

    for expected_origin in expected_origins.iter() {
        assert!(
            result.trusted_origins.contains(expected_origin),
            "icrc28_trusted_origins should contain {}",
            expected_origin
        );
    }
}
