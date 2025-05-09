// src/kong_backend/tests/test_adding_tokens.rs
//
// Tests for adding tokens to the Kong DEX

pub mod common;
mod setup_test_tokens;

use anyhow::Result;
use candid::{decode_one, encode_one, CandidType, Deserialize, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;

use common::pic_ext::{ensure_processed, pic_query, pic_update};
use common::setup::setup_ic_environment;
use common::icrc3_ledger::create_icrc3_ledger;

#[derive(CandidType, Debug)]
struct AddTokenArgs {
    token: String,
}

#[derive(candid::Deserialize, CandidType, Debug)]
enum TokensResult {
    Ok(Vec<TokensReply>),
    Err(String),
}

#[derive(candid::Deserialize, CandidType, Debug)]
enum TokensReply {
    IC(ICTokenReply),
    LP(LPTokenReply),
}

#[derive(candid::Deserialize, CandidType, Debug)]
struct ICTokenReply {
    token_id: u32,
    canister_id: String,
    name: String,
    symbol: String,
    decimals: u8,
    fee: Nat,
    logo: Option<String>,
    standard: String,
}

#[derive(candid::Deserialize, CandidType, Debug)]
struct LPTokenReply {
    token_id: u32,
    name: String,
    symbol: String,
    decimals: u8,
    logo: Option<String>,
}

/// Test for adding tokens to the Kong DEX
#[test]
fn test_adding_tokens() -> Result<()> {
    println!("Setting up test environment for adding tokens test...");

    // Set up test environment with the Kong backend
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    // Get controller from the PocketIc controllers
    let controllers = ic.get_controllers(kong_backend);
    assert!(!controllers.is_empty(), "Failed to get controllers");
    let controller = controllers[0];
    
    // Print debug info
    println!("Test Debug Info:");
    println!("Controller principal: {}", controller.to_text());
    println!("Kong backend canister principal: {}", kong_backend.to_text());

    // Step 1: Deploy token ledgers
    println!("STEP 1: Deploying token ledgers...");
    
    // Set up ICP ledger
    let icp_ledger = setup_test_tokens::create_test_icp_ledger(&ic, &controller)?;
    println!("Created ICP ledger: {}", icp_ledger);

    // Set up ICRC3 token ledger for ckUSDT
    let ckusdt_ledger = create_icrc3_ledger(
        &ic,
        &controller,
        "ckUSDT",
        "ckUSDT",
        8,      // 8 decimals
        // Pre-mint tokens to the minting account
        vec![(
            Account {
                owner: controller,
                subaccount: None,
            },
            Nat::from(10_000_000_000_000u64), // 100,000 ckUSDT
        )],
    )?;
    ensure_processed(&ic);
    println!("Created ckUSDT token ledger: {}", ckusdt_ledger);
    
    // Set up ICRC3 token ledger for ckBTC
    let ckbtc_ledger = create_icrc3_ledger(
        &ic,
        &controller,
        "ckBTC",
        "ckBTC",
        8,      // 8 decimals
        // Pre-mint tokens to the minting account
        vec![(
            Account {
                owner: controller,
                subaccount: None,
            },
            Nat::from(100_000_000_000u64), // 1,000 ckBTC
        )],
    )?;
    ensure_processed(&ic);
    println!("Created ckBTC token ledger: {}", ckbtc_ledger);

    // Verify initial state of tokens in Kong DEX
    println!("STEP 2: Querying initial tokens in Kong DEX...");
    let tokens_args = encode_one(())?;
    let tokens_result_bytes = pic_query(&ic, kong_backend, Principal::anonymous(), "tokens", tokens_args)?;
    let tokens_result: TokensResult = decode_one(&tokens_result_bytes)?;
    
    match tokens_result {
        TokensResult::Ok(initial_tokens) => {
            println!("Initial tokens in Kong DEX: {} tokens", initial_tokens.len());
            for token in &initial_tokens {
                if let TokensReply::IC(reply) = token {
                    println!("Token ID: {}, Symbol: {}, Canister: {}", 
                             reply.token_id, reply.symbol, reply.canister_id);
                }
            }
        },
        TokensResult::Err(e) => panic!("Initial tokens query failed: {}", e),
    }

    // Step 3: Add ICP token to Kong DEX
    println!("STEP 3: Adding ICP token to Kong DEX...");
    let add_icp_args = AddTokenArgs {
        token: format!("IC.{}", icp_ledger.to_string()),
    };

    let args = encode_one(add_icp_args)?;
    println!("Sending add_token request for ICP");
    let result = pic_update(&ic, kong_backend, controller, "add_token", args)?;
    let _: () = decode_one(&result)?;
    println!("ICP token added successfully");
    ensure_processed(&ic);

    // Step 4: Add ckUSDT token to Kong DEX
    println!("STEP 4: Adding ckUSDT token to Kong DEX...");
    let add_ckusdt_args = AddTokenArgs {
        token: format!("IC.{}", ckusdt_ledger.to_string()),
    };

    let args = encode_one(add_ckusdt_args)?;
    println!("Sending add_token request for ckUSDT");
    let result = pic_update(&ic, kong_backend, controller, "add_token", args)?;
    let _: () = decode_one(&result)?;
    println!("ckUSDT token added successfully");
    ensure_processed(&ic);
    
    // Step 5: Add ckBTC token to Kong DEX
    println!("STEP 5: Adding ckBTC token to Kong DEX...");
    let add_ckbtc_args = AddTokenArgs {
        token: format!("IC.{}", ckbtc_ledger.to_string()),
    };

    let args = encode_one(add_ckbtc_args)?;
    println!("Sending add_token request for ckBTC");
    let result = pic_update(&ic, kong_backend, controller, "add_token", args)?;
    let _: () = decode_one(&result)?;
    println!("ckBTC token added successfully");
    ensure_processed(&ic);

    // Step 6: Verify all tokens were added correctly
    println!("STEP 6: Verifying all tokens were added to Kong DEX...");
    let tokens_args = encode_one(())?;
    let tokens_result_bytes = pic_query(&ic, kong_backend, Principal::anonymous(), "tokens", tokens_args)?;
    let tokens_result: TokensResult = decode_one(&tokens_result_bytes)?;
    
    let tokens = match tokens_result {
        TokensResult::Ok(tokens) => tokens,
        TokensResult::Err(e) => panic!("Tokens query failed: {}", e),
    };

    println!("Final tokens in Kong DEX: {} tokens", tokens.len());
    
    // Extract token IDs by canister ID
    let mut icp_token_id: Option<u32> = None;
    let mut ckusdt_token_id: Option<u32> = None;
    let mut ckbtc_token_id: Option<u32> = None;
    
    for token in tokens {
        if let TokensReply::IC(reply) = token {
            println!("Token ID: {}, Symbol: {}, Canister: {}", 
                     reply.token_id, reply.symbol, reply.canister_id);
            
            if reply.canister_id == icp_ledger.to_string() {
                icp_token_id = Some(reply.token_id);
                assert_eq!(reply.symbol, "ICP", "ICP token has wrong symbol");
            } else if reply.canister_id == ckusdt_ledger.to_string() {
                ckusdt_token_id = Some(reply.token_id);
                assert_eq!(reply.symbol, "ckUSDT", "ckUSDT token has wrong symbol");
            } else if reply.canister_id == ckbtc_ledger.to_string() {
                ckbtc_token_id = Some(reply.token_id);
                assert_eq!(reply.symbol, "ckBTC", "ckBTC token has wrong symbol");
            }
        }
    }
    
    // Verify all tokens were added
    assert!(icp_token_id.is_some(), "ICP token was not added to Kong DEX");
    assert!(ckusdt_token_id.is_some(), "ckUSDT token was not added to Kong DEX");
    assert!(ckbtc_token_id.is_some(), "ckBTC token was not added to Kong DEX");
    
    println!("ICP token ID: {}", icp_token_id.unwrap());
    println!("ckUSDT token ID: {}", ckusdt_token_id.unwrap());
    println!("ckBTC token ID: {}", ckbtc_token_id.unwrap());
    
    println!("All tokens were added correctly to Kong DEX");
    
    println!("Adding tokens test completed successfully!");
    Ok(())
}