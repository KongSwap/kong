// src/kong_backend/tests/test_environment_setup.rs
//
// Tests for setting up the test environment and deploying ledgers

pub mod common;
mod setup_test_tokens;

use anyhow::Result;
use candid::{decode_one, encode_one, Principal};
use icrc_ledger_types::icrc1::account::Account;

use common::pic_ext::{ensure_processed, pic_query};
use common::setup::setup_ic_environment;
use common::icrc3_ledger::create_icrc3_ledger;

/// Test that verifies the basic setup of the test environment:
/// 1. Setting up the IC environment with PocketIC
/// 2. Creating the Kong backend canister
/// 3. Deploying ICP and ICRC3 token ledgers
#[test]
fn test_environment_setup() -> Result<()> {
    println!("Setting up test environment...");

    // Set up test environment with the Kong backend
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    // Get User A (controller) from the PocketIc controllers
    let controllers = ic.get_controllers(kong_backend);
    assert!(!controllers.is_empty(), "Failed to get controllers");
    let controller = controllers[0];
    
    // Create user identities with specific byte patterns
    let user_a = Principal::from_slice(&[1, 2, 3, 4, 5]); // Controller role
    let user_b = Principal::from_slice(&[6, 7, 8, 9, 10]); // Liquidity provider
    let user_c = Principal::from_slice(&[11, 12, 13, 14, 15]); // Normal user
    
    // Print debug info about the identities
    println!("Test Debug Info:");
    println!("Controller principal: {}", controller.to_text());
    println!("User A (controller/owner) principal: {}", user_a.to_text());
    println!("User B (liquidity provider) principal: {}", user_b.to_text());
    println!("User C (normal user) principal: {}", user_c.to_text());
    println!("Kong backend canister principal: {}", kong_backend.to_text());

    // Step 1: Deploy ICP ledger
    println!("STEP 1: Deploying ICP ledger...");
    let icp_ledger = setup_test_tokens::create_test_icp_ledger(&ic, &controller)?;
    println!("Created ICP ledger: {}", icp_ledger);

    // Verify ICP ledger was created by checking its token symbol
    let args = encode_one(())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_symbol", args)?;
    let symbol: String = decode_one(&result)?;
    assert_eq!(symbol, "ICP", "ICP ledger has wrong symbol");

    // Step 2: Deploy ICRC3 token ledger for ckUSDT
    println!("STEP 2: Deploying ICRC3 token ledger (ckUSDT)...");
    let ckusdt_ledger = create_icrc3_ledger(
        &ic,
        &controller,
        "ckUSDT",
        "ckUSDT",
        8,      // 8 decimals
        // Pre-mint tokens to the minting account so it has tokens to transfer
        vec![(
            Account {
                owner: controller,
                subaccount: None,
            },
            candid::Nat::from(10_000_000_000_000u64), // 100,000 ckUSDT
        )],
    )?;
    ensure_processed(&ic);
    println!("Created ckUSDT token ledger: {}", ckusdt_ledger);

    // Verify ckUSDT ledger was created by checking its token symbol
    let args = encode_one(())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_symbol", args)?;
    let symbol: String = decode_one(&result)?;
    assert_eq!(symbol, "ckUSDT", "ckUSDT ledger has wrong symbol");

    // Verify ckUSDT decimals
    let args = encode_one(())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_decimals", args)?;
    let decimals: u8 = decode_one(&result)?;
    assert_eq!(decimals, 8, "ckUSDT ledger has wrong decimals");

    // Verify total supply
    let args = encode_one(())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_total_supply", args)?;
    let total_supply: candid::Nat = decode_one(&result)?;
    println!("ckUSDT total supply: {}", total_supply);
    assert!(total_supply > candid::Nat::from(0u64), "ckUSDT total supply is zero");

    // Get minting account for both ledgers
    let minting_account_args = encode_one(())?;

    // ICP minting account
    let result = pic_query(
        &ic,
        icp_ledger,
        Principal::anonymous(),
        "icrc1_minting_account",
        minting_account_args.clone(),
    )?;
    let icp_minting_account: Option<Account> = decode_one(&result)?;
    let icp_minting_account = icp_minting_account.unwrap();
    
    // ckUSDT minting account
    let result = pic_query(
        &ic,
        ckusdt_ledger,
        Principal::anonymous(),
        "icrc1_minting_account",
        minting_account_args,
    )?;
    let ckusdt_minting_account: Option<Account> = decode_one(&result)?;
    let ckusdt_minting_account = ckusdt_minting_account.unwrap();
    
    // Debug minting account details
    println!("ICP minting account principal: {}", icp_minting_account.owner.to_text());
    println!("ICP minting account subaccount: {}", 
        if icp_minting_account.subaccount.is_some() { 
            "Some([...])" 
        } else { 
            "None" 
        }
    );
    println!("ckUSDT minting account principal: {}", ckusdt_minting_account.owner.to_text());
    println!("ckUSDT minting account subaccount: {}", 
        if ckusdt_minting_account.subaccount.is_some() { 
            "Some([...])" 
        } else { 
            "None" 
        }
    );
    
    // Verify the minting account balances
    
    // ICP minting account balance
    let balance_args = encode_one(icp_minting_account.clone())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let icp_mint_balance: candid::Nat = decode_one(&result)?;
    println!("ICP minting account balance: {}", icp_mint_balance);
    assert!(icp_mint_balance > candid::Nat::from(0u64), "ICP minting account balance is zero");
    
    // ckUSDT minting account balance
    let balance_args = encode_one(ckusdt_minting_account.clone())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let ckusdt_mint_balance: candid::Nat = decode_one(&result)?;
    println!("ckUSDT minting account balance: {}", ckusdt_mint_balance);
    assert!(ckusdt_mint_balance > candid::Nat::from(0u64), "ckUSDT minting account balance is zero");
    
    println!("Environment setup and token deployment test completed successfully!");
    Ok(())
}