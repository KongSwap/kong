mod common;

use candid::{encode_args, encode_one, Principal};
use common::{
    create_canister, create_session_identity, create_wallet, full_login, init, query, update,
    valid_settings, RuntimeFeature, SESSION_KEY,
};
use ic_agent::Identity;
use ic_siws::{delegation::SignedDelegation, login::LoginDetails, siws::SiwsMessage};
use pocket_ic::PocketIc;
use serde_bytes::ByteBuf;
use std::time::Duration;

use crate::common::{prepare_login_and_sign_message, SettingsInput, VALID_PUBKEY};

#[test]
#[should_panic]
fn test_init_with_no_settings() {
    let ic = PocketIc::new();
    let (canister_id, wasm_module) = common::create_canister(&ic);
    let sender = None;
    // Empty init argument, should cause a panic
    ic.install_canister(canister_id, wasm_module, encode_one(()).unwrap(), sender);
}

#[test]
fn test_init_with_valid_settings() {
    let ic = PocketIc::new();
    let (canister_id, wasm_module) = common::create_canister(&ic);
    let settings = valid_settings(canister_id, None);
    let arg = encode_one(settings).unwrap();
    let sender = None;
    ic.install_canister(canister_id, wasm_module, arg, sender);
}

#[test]
#[should_panic]
fn test_init_with_invalid_settings() {
    let ic = PocketIc::new();
    let (canister_id, wasm_module) = common::create_canister(&ic);
    let mut settings = valid_settings(canister_id, None);
    settings.domain = "invalid domain".to_string(); // Invalid domain, should cause a panic
    let arg = encode_one(settings).unwrap();
    let sender = None;
    ic.install_canister(canister_id, wasm_module, arg, sender);
}

#[test]
fn test_upgrade_with_changed_arguments() {
    let ic = PocketIc::new();

    // First, install
    let (ic_siws_provider_canister, _) = init(&ic, None);

    // Then, upgrade
    let wasm_path: std::ffi::OsString =
        std::env::var_os("IC_SIWS_PROVIDER_PATH").expect("Missing ic_siws_provider wasm file");
    let wasm_module = std::fs::read(wasm_path).unwrap();
    let targets: Option<Vec<Principal>> = Some(vec![ic_siws_provider_canister]);
    let settings = SettingsInput {
        domain: "192.168.0.1".to_string(),
        uri: "http://192.168.0.1:666".to_string(),
        salt: "another-salt".to_string(),
        chain_id: Some(666),
        scheme: Some("https".to_string()),
        statement: Some("Some login statement".to_string()),
        sign_in_expires_in: Some(Duration::from_secs(300).as_nanos() as u64), // 5 minutes
        session_expires_in: Some(Duration::from_secs(60 * 60 * 24 * 14).as_nanos() as u64), // 2 weeks
        targets: targets.clone(),
        runtime_features: None,
    };
    let arg = encode_one(settings).unwrap();
    let sender = None;
    let upgrade_result =
        ic.upgrade_canister(ic_siws_provider_canister, wasm_module, arg.clone(), sender);
    assert!(upgrade_result.is_ok());

    // Fast forward in time to allow the ic_siws_provider_canister to be fully installed.
    for _ in 0..5 {
        ic.tick();
    }

    // Call siws_prepare_login, check that new settings are reflected in returned siws_message
    let pubkey = encode_one(VALID_PUBKEY).unwrap();
    let response: Result<SiwsMessage, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_prepare_login",
        pubkey,
    );
    assert!(response.is_ok());
}

#[test]
fn test_upgrade_with_no_settings() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let wasm_path: std::ffi::OsString =
        std::env::var_os("IC_SIWS_PROVIDER_PATH").expect("Missing ic_siws_provider wasm file");
    let wasm_module = std::fs::read(wasm_path).unwrap();
    let sender = None;
    let result = ic.upgrade_canister(
        ic_siws_provider_canister,
        wasm_module,
        encode_one(()).unwrap(),
        sender,
    );
    assert!(result.is_err());
}

#[test]
fn test_siws_prepare_login_invalid_pubkey_legth() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let pubkey = encode_one("4odadvBKw1").unwrap(); // Invalid length
    let response: Result<SiwsMessage, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_prepare_login",
        pubkey,
    );
    assert_eq!(response.unwrap_err(), "String is the wrong size");
}

#[test]
fn test_siws_prepare_login_invalid_pubkey() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let pubkey = encode_one("invalid pubkey").unwrap();
    let response: Result<SiwsMessage, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_prepare_login",
        pubkey,
    );
    assert_eq!(response.unwrap_err(), "Invalid Base58 string");
}

#[test]
fn test_siws_prepare_login_ok() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let pubkey = encode_one(VALID_PUBKEY).unwrap();
    let response: Result<SiwsMessage, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_prepare_login",
        pubkey,
    );
    assert!(response.is_ok());
}

#[test]
fn test_login_signature_too_short() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let signature = "4odadvBKw1"; // Too short
    let args = encode_args((signature, VALID_PUBKEY, SESSION_KEY)).unwrap();
    let response: Result<LoginDetails, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        args,
    );
    assert_eq!(response.unwrap_err(), "String is the wrong size");
}

#[test]
fn test_login_signature_too_long() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let signature = "4odadvBKw14odadvBKw14odadvBKw14odadvBKw14odadvBKw14odadvBKw14odadvBKw14odadvBKw14odadvBKw14odadvBKw14odadvBKw14odadvBKw14odadvBKw1"; // Too long
    let args = encode_args((signature, VALID_PUBKEY, SESSION_KEY)).unwrap();
    let response: Result<LoginDetails, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        args,
    );
    assert_eq!(response.unwrap_err(), "String is the wrong size");
}

#[test]
fn test_incorrect_signature_format() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let signature = "INVALID SIGNATURE FORMAT";
    let args = encode_args((signature, VALID_PUBKEY, SESSION_KEY)).unwrap();
    let response: Result<LoginDetails, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        args,
    );
    assert_eq!(response.unwrap_err(), "Invalid Base58 string");
}

// Generated SIWS messages are only valid for a set amount of time. Fast forward in time to make the message expire.
#[test]
fn test_sign_in_message_expired() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let (wallet, pubkey) = create_wallet();
    let (signature, _) = prepare_login_and_sign_message(&ic, ic_siws_provider_canister, &wallet);

    ic.advance_time(Duration::from_secs(10));

    let args = encode_args((signature, pubkey, SESSION_KEY)).unwrap();
    let response: Result<LoginDetails, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        args,
    );
    assert_eq!(response.unwrap_err(), "Message not found");
}

// A valid signature but with a different pubkey
#[test]
fn test_sign_in_address_mismatch() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let (wallet, _) = create_wallet();
    let (signature, _) = prepare_login_and_sign_message(&ic, ic_siws_provider_canister, &wallet);
    let args = encode_args((signature, VALID_PUBKEY, SESSION_KEY)).unwrap(); // Wrong pubkey
    let response: Result<LoginDetails, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        args,
    );
    assert_eq!(response.unwrap_err(), "Message not found");
}

// A manilulated signature with the correct pubkey
#[test]
fn test_sign_in_signature_manipulated() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let (wallet, pubkey) = create_wallet();
    let (_, _) = prepare_login_and_sign_message(&ic, ic_siws_provider_canister, &wallet);
    let manipulated_signature =
        "5TgJLdKQZ8UjBZLbVjHHQ9kZigxmAgDKqGdZKdJzF8iMWri93N4d2Q7RfQJHReAqyQzSJf9B4MeqGTPJkH6RcW72";
    let args = encode_args((manipulated_signature, pubkey, SESSION_KEY)).unwrap();
    let response: Result<LoginDetails, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        args,
    );
    assert_eq!(response.unwrap_err(), "Signature verification failed");
}

#[test]
fn test_sign_in_ok() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let (wallet, pubkey) = create_wallet();
    let (signature, _) = prepare_login_and_sign_message(&ic, ic_siws_provider_canister, &wallet);
    let args = encode_args((signature, pubkey, SESSION_KEY)).unwrap();
    let response: Result<LoginDetails, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        args,
    );
    assert!(response.is_ok());
    assert!(response.unwrap().user_canister_pubkey.len() == 62);
}

// Use the same signature twice. This should fail because the message is already used.
#[test]
fn test_sign_in_replay_attack() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);
    let (wallet, pubkey) = create_wallet();
    let (signature, _) = prepare_login_and_sign_message(&ic, ic_siws_provider_canister, &wallet);
    let args = encode_args((signature, pubkey, SESSION_KEY)).unwrap();
    let response: Result<LoginDetails, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        args.clone(),
    );
    assert!(response.is_ok());
    let second_response: Result<LoginDetails, String> = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        args,
    );
    assert_eq!(second_response.unwrap_err(), "Message not found");
}

#[test]
fn test_sign_in_siws_get_delegation() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, targets) = init(&ic, None);
    let (_, _) = full_login(&ic, ic_siws_provider_canister, targets);
}

// After login, the delegation needs to be fetched before the delegation signature expires. Fast forward in time to make
// the delegation signature expire.
#[test]
fn test_sign_in_siws_get_delegation_timeout() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, _) = init(&ic, None);

    // Create wallet and session identity
    let (wallet1, pubkey1) = create_wallet();
    let (signature, _) = prepare_login_and_sign_message(&ic, ic_siws_provider_canister, &wallet1);
    let session_identity = create_session_identity();
    let session_pubkey = session_identity.public_key().unwrap();

    // Login
    let login_args = encode_args((signature, pubkey1.clone(), session_pubkey.clone())).unwrap();
    let login_response: LoginDetails = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        login_args,
    )
    .unwrap();

    // Fast forward in time to make the delegation signature expire. Exired signatures are pruned every time
    // login is called.
    ic.advance_time(Duration::from_secs(100));

    // Create another wallet and session identity
    let (wallet2, pubkey2) = create_wallet();
    let (signature2, _) = prepare_login_and_sign_message(&ic, ic_siws_provider_canister, &wallet2);
    let session_identity2 = create_session_identity();
    let session_pubkey2 = session_identity2.public_key().unwrap();

    // Login pubkey 2, this should cause the delegation signature for pubkey 1 to be pruned
    let login_args2 = encode_args((signature2, pubkey2.clone(), session_pubkey2.clone())).unwrap();
    let _: LoginDetails = update(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_login",
        login_args2,
    )
    .unwrap();

    // Get the delegation for pubkey 1, this should fail because the delegation signature has been pruned
    let siws_get_delegation_args = encode_args((
        pubkey1.clone(),
        session_pubkey.clone(),
        login_response.expiration,
    ))
    .unwrap();
    let siws_get_delegation_response: Result<SignedDelegation, String> = query(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "siws_get_delegation",
        siws_get_delegation_args,
    );

    assert!(siws_get_delegation_response.is_err());
}

#[test]
fn test_get_caller_address() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, targets) = init(&ic, None);
    let (pubkey, delegated_identity) = full_login(&ic, ic_siws_provider_canister, targets);
    let caller_address_response: Result<String, String> = query(
        &ic,
        delegated_identity.sender().unwrap(),
        ic_siws_provider_canister,
        "get_caller_address",
        encode_one(()).unwrap(),
    );
    assert!(caller_address_response.is_ok());
    assert_eq!(caller_address_response.unwrap(), pubkey);
}

#[test]
fn test_get_caller_address_principal_not_logged_in() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, targets) = init(&ic, None);
    let (_, _) = full_login(&ic, ic_siws_provider_canister, targets);
    let response: Result<String, String> = query(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "get_caller_address",
        encode_one(()).unwrap(),
    );
    assert!(response.is_err());
    assert_eq!(response.unwrap_err(), "Principal not found");
}

#[test]
fn test_get_address() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, targets) = init(&ic, None);
    let (pubkey, delegated_identity) = full_login(&ic, ic_siws_provider_canister, targets);
    let response: Result<String, String> = query(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "get_address",
        encode_one(delegated_identity.sender().unwrap().as_slice()).unwrap(),
    );
    // assert!(response.is_ok());
    assert_eq!(response.unwrap(), pubkey);
}

#[test]
fn test_get_address_not_found() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, targets) = init(&ic, None);
    let (_, _) = full_login(&ic, ic_siws_provider_canister, targets);
    let response: Result<String, String> = query(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "get_address",
        encode_one(Principal::anonymous().as_slice()).unwrap(),
    );
    assert!(response.is_err());
    assert_eq!(response.unwrap_err(), "Principal not found");
}

#[test]
fn test_get_principal() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, targets) = init(&ic, None);
    let (pubkey, delegated_identity) = full_login(&ic, ic_siws_provider_canister, targets);
    let response: Result<ByteBuf, String> = query(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "get_principal",
        encode_one(pubkey).unwrap(),
    );
    assert!(response.is_ok());
    assert_eq!(
        response.unwrap(),
        delegated_identity.sender().unwrap().as_slice()
    );
}

#[test]
fn test_get_principal_not_found() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, targets) = init(&ic, None);
    let (_, _) = full_login(&ic, ic_siws_provider_canister, targets);
    let response: Result<ByteBuf, String> = query(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "get_principal",
        encode_one(VALID_PUBKEY).unwrap(),
    );
    assert!(response.is_err());
    assert_eq!(
        response.unwrap_err(),
        "No principal found for the given address"
    );
}

pub fn settings_disable_sol_and_principal_mapping(
    canister_id: Principal,
    targets: Option<Vec<Principal>>,
) -> SettingsInput {
    // If specific targets have been listed, add the canister id of this canister to the list of targets.
    let targets: Option<Vec<Principal>> = match targets {
        Some(targets) => {
            let mut targets = targets;
            targets.push(canister_id);
            Some(targets)
        }
        None => None,
    };

    SettingsInput {
        domain: "127.0.0.1".to_string(),
        uri: "http://127.0.0.1:5173".to_string(),
        salt: "dummy-salt".to_string(),
        chain_id: Some(10),
        scheme: Some("http".to_string()),
        statement: Some("Login to the app".to_string()),
        sign_in_expires_in: Some(Duration::from_secs(3).as_nanos() as u64), // 3 seconds
        session_expires_in: Some(Duration::from_secs(60 * 60 * 24 * 7).as_nanos() as u64), // 1 week
        targets: targets.clone(),
        runtime_features: Some(vec![
            RuntimeFeature::DisableSolToPrincipalMapping,
            RuntimeFeature::DisablePrincipalToSolMapping,
        ]),
    }
}

pub fn init_disable_sol_and_principal_mapping(
    ic: &PocketIc,
    targets: Option<Vec<Principal>>,
) -> (Principal, Option<Vec<Principal>>) {
    let (canister_id, wasm_module) = create_canister(ic);
    let settings = settings_disable_sol_and_principal_mapping(canister_id, targets.clone());
    let arg = encode_one(settings).unwrap();
    let sender = None;

    ic.install_canister(canister_id, wasm_module, arg.clone(), sender);

    // Fast forward in time to allow the ic_siws_provider_canister to be fully installed.
    for _ in 0..5 {
        ic.tick();
    }

    (canister_id, targets)
}

#[test]
fn test_sol_to_principal_mapping_disabled() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, targets) = init_disable_sol_and_principal_mapping(&ic, None);
    let (_, _) = full_login(&ic, ic_siws_provider_canister, targets);
    let response: Result<ByteBuf, String> = query(
        &ic,
        Principal::anonymous(),
        ic_siws_provider_canister,
        "get_principal",
        encode_one(VALID_PUBKEY).unwrap(),
    );
    assert!(response.is_err());
    assert_eq!(
        response.unwrap_err(),
        "Solana pubkey to principal mapping is disabled"
    );
}

#[test]
fn test_principal_to_sol_mapping_disabled() {
    let ic = PocketIc::new();
    let (ic_siws_provider_canister, targets) = init_disable_sol_and_principal_mapping(&ic, None);
    let (_, delegated_identity) = full_login(&ic, ic_siws_provider_canister, targets);
    let response: Result<String, String> = query(
        &ic,
        delegated_identity.sender().unwrap(),
        ic_siws_provider_canister,
        "get_address",
        encode_one(delegated_identity.sender().unwrap().as_slice()).unwrap(),
    );
    assert!(response.is_err());
    assert_eq!(
        response.unwrap_err(),
        "Principal to Solana address mapping is disabled"
    );
}
