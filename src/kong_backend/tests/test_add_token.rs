pub mod common;

use anyhow::Result;
use candid::{decode_one, encode_one, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use kong_backend::add_token::add_token_args::AddTokenArgs;
use kong_backend::add_token::add_token_reply::AddTokenReply;
use kong_backend::tokens::tokens_reply::TokensReply;

use common::icrc1_ledger::{ArchiveOptions, FeatureFlags, InitArgs, LedgerArg, create_icrc1_ledger};
use common::identity::get_identity_from_pem_file;
use common::setup::{setup_ic_environment, CONTROLLER_PEM_FILE};

const TOKEN_SYMBOL: &str = "TEST";
const TOKEN_NAME: &str = "Test Token";
const TOKEN_FEE: u64 = 10_000;
const TOKEN_DECIMALS: u8 = 8;

// Helper function to create a test ICRC1 token for testing
fn setup_test_token(ic: &pocket_ic::PocketIc, controller: Principal) -> Result<Principal> {
    // Create an ICRC1 token canister for testing
    let controller_account = Account {
        owner: controller,
        subaccount: None,
    };
    
    let init_args = InitArgs {
        minting_account: controller_account,
        fee_collector_account: None,
        transfer_fee: Nat::from(TOKEN_FEE),
        decimals: Some(TOKEN_DECIMALS),
        max_memo_length: Some(32),
        token_symbol: TOKEN_SYMBOL.to_string(),
        token_name: TOKEN_NAME.to_string(),
        metadata: vec![],
        initial_balances: vec![],
        feature_flags: Some(FeatureFlags {
            icrc2: true,
            icrc3: true,
        }),
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 5_000,
            max_transactions_per_response: None,
            trigger_threshold: 10_00,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: controller,
            more_controller_ids: None,
        },
    };
    
    let ledger_arg = LedgerArg::Init(init_args);
    create_icrc1_ledger(ic, &Some(controller), &ledger_arg)
}

#[test]
fn test_add_token_as_controller() {
    // Setup the test environment
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");
    
    // Get the controller identity
    let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE)
        .expect("Failed to get controller identity");
    let controller_principal_id = controller_identity
        .sender()
        .expect("Failed to get controller principal id");
    
    // Create a test token canister
    let test_token_canister = setup_test_token(&ic, controller_principal_id)
        .expect("Failed to setup test token");
    
    // Prepare the token address in IC format
    let token_address = format!("IC.{}", test_token_canister.to_text());
    
    // Call add_token as controller
    let add_token_args = AddTokenArgs {
        token: token_address.clone(),
        ..Default::default()
    };
    
    let args = encode_one(&add_token_args).expect("Failed to encode add_token arguments");
    let Ok(response) = ic.update_call(
        kong_backend,
        controller_principal_id,
        "add_token",
        args,
    ) else {
        panic!("Failed to call add_token");
    };
    
    let result = decode_one::<Result<AddTokenReply, String>>(&response)
        .expect("Failed to decode add_token response");
    
    assert!(result.is_ok(), "add_token should succeed, but got {:?}", result);
    
    // Verify the token is now in the tokens list
    let tokens_args = encode_one(()).expect("Failed to encode tokens arguments");
    let Ok(tokens_response) = ic.query_call(
        kong_backend,
        Principal::anonymous(),
        "tokens",
        tokens_args,
    ) else {
        panic!("Failed to query tokens");
    };
    
    let tokens_result = decode_one::<Result<Vec<TokensReply>, String>>(&tokens_response)
        .expect("Failed to decode tokens response");
    
    assert!(tokens_result.is_ok(), "tokens should be Ok, but got {:?}", tokens_result);
    
    let tokens = tokens_result.unwrap();
    assert!(!tokens.is_empty(), "tokens should not be empty");
    
    let found_token = tokens.iter().find(|token_reply| {
        if let TokensReply::IC(ic_token) = *token_reply { // *token_reply is &TokensReply, ic_token becomes &ICReply
            ic_token.canister_id == test_token_canister.to_text()
        } else {
            false // Not an IC token, or not the one we're looking for
        }
    });
    assert!(found_token.is_some(), "Added token should be in the tokens list");
    
    // found_token is Option<&&TokensReply>. Since we asserted is_some(), unwrap is safe.
    let token_reply_ref_ref = found_token.unwrap(); 
    let ic_token_data = if let TokensReply::IC(data) = token_reply_ref_ref { // token_reply_ref_ref is &TokensReply, if let auto-derefs for match
        data // data will be &ICReply
    } else {
        // This case should ideally not be reached if the find logic and token setup are correct
        // and we only add IC tokens in this test.
        panic!("Expected TokensReply::IC variant after finding token, but found something else.");
    }; 

    assert_eq!(ic_token_data.symbol, TOKEN_SYMBOL);
    assert_eq!(ic_token_data.name, TOKEN_NAME);
    assert_eq!(ic_token_data.decimals, TOKEN_DECIMALS);
    assert_eq!(ic_token_data.fee, Nat::from(TOKEN_FEE));
    assert!(ic_token_data.icrc1);
    assert!(ic_token_data.icrc2);
}

#[test]
fn test_add_token_idempotency() {
    // Setup the test environment
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");
    
    // Get the controller identity
    let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE)
        .expect("Failed to get controller identity");
    let controller_principal_id = controller_identity
        .sender()
        .expect("Failed to get controller principal id");
    
    // Create a test token canister
    let test_token_canister = setup_test_token(&ic, controller_principal_id)
        .expect("Failed to setup test token");
    
    // Prepare the token address in IC format
    let token_address = format!("IC.{}", test_token_canister.to_text());
    
    // First add_token call should succeed
    let add_token_args = AddTokenArgs {
        token: token_address.clone(),
        ..Default::default()
    };
    
    let args = encode_one(&add_token_args).expect("Failed to encode add_token arguments");
    let Ok(response) = ic.update_call(
        kong_backend,
        controller_principal_id,
        "add_token",
        args,
    ) else {
        panic!("Failed to call add_token");
    };
    
    let result = decode_one::<Result<AddTokenReply, String>>(&response)
        .expect("Failed to decode add_token response");
    
    assert!(result.is_ok(), "First add_token should succeed, but got {:?}", result);
    
    // Second add_token call with the same token should fail
    let args = encode_one(&add_token_args).expect("Failed to encode add_token arguments");
    let Ok(response) = ic.update_call(
        kong_backend,
        controller_principal_id,
        "add_token",
        args,
    ) else {
        panic!("Failed to call add_token");
    };
    
    let result = decode_one::<Result<AddTokenReply, String>>(&response)
        .expect("Failed to decode add_token response");
    
    assert!(result.is_err(), "Second add_token should fail, but got {:?}", result);
    let error = result.unwrap_err();
    assert!(error.contains("already exists"), 
        "Error should mention that token already exists, but got: {}", error);
}
