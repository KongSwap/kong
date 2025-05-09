// src/kong_backend/tests/test_minting_and_balances.rs
//
// Tests for minting tokens to users and verifying balances

pub mod common;
mod setup_test_tokens;

use anyhow::Result;
use candid::{decode_one, encode_one, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

use common::pic_ext::{ensure_processed, pic_query, pic_update};
use common::setup::setup_ic_environment;
use common::icrc3_ledger::create_icrc3_ledger;

/// Test minting tokens to different users and verifying balances
#[test]
fn test_mint_tokens_and_verify_balances() -> Result<()> {
    println!("Setting up test environment for minting test...");

    // Set up test environment with the Kong backend
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    // Get controller from the PocketIc controllers
    let controllers = ic.get_controllers(kong_backend);
    assert!(!controllers.is_empty(), "Failed to get controllers");
    let controller = controllers[0];
    
    // Create user identities with specific byte patterns
    let user_a = Principal::from_slice(&[1, 2, 3, 4, 5]);
    let user_b = Principal::from_slice(&[6, 7, 8, 9, 10]);
    let user_c = Principal::from_slice(&[11, 12, 13, 14, 15]);
    
    // Print debug info about the identities
    println!("Test Debug Info:");
    println!("Controller principal: {}", controller.to_text());
    println!("User A principal: {}", user_a.to_text());
    println!("User B principal: {}", user_b.to_text());
    println!("User C principal: {}", user_c.to_text());

    // Always use an explicit [0;32] for the default subaccount to match Kong's verifier
    let zero_sub = Some([0u8; 32]);
    
    // Set up accounts with explicit zero subaccounts
    let user_a_account = Account {
        owner: user_a,
        subaccount: zero_sub,
    };
    
    let user_b_account = Account {
        owner: user_b,
        subaccount: zero_sub,
    };
    
    let user_c_account = Account {
        owner: user_c,
        subaccount: zero_sub,
    };
    
    let controller_account = Account {
        owner: controller,
        subaccount: zero_sub,
    };

    // Deploy ledgers
    println!("Deploying token ledgers...");
    
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
        // Pre-mint tokens to the minting account so it has tokens to transfer
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

    // Get minting account for both ledgers
    let minting_account_args = encode_one(())?;

    let result = pic_query(
        &ic,
        icp_ledger,
        Principal::anonymous(),
        "icrc1_minting_account",
        minting_account_args.clone(),
    )?;
    let icp_minting_account: Option<Account> = decode_one(&result)?;
    let icp_minting_account = icp_minting_account.unwrap();
    
    let result = pic_query(
        &ic,
        ckusdt_ledger,
        Principal::anonymous(),
        "icrc1_minting_account",
        minting_account_args,
    )?;
    let ckusdt_minting_account: Option<Account> = decode_one(&result)?;
    let ckusdt_minting_account = ckusdt_minting_account.unwrap();
    
    // Test 1: Mint ICP tokens to User A
    println!("TEST 1: Minting ICP tokens to User A...");
    
    let icp_amount_a = Nat::from(500_000_000_000u64); // 5,000 ICP
    
    let icp_transfer_args = TransferArg {
        from_subaccount: icp_minting_account.subaccount,
        to: user_a_account.clone(),
        amount: icp_amount_a.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let args = encode_one(icp_transfer_args)?;
    let result = pic_update(&ic, icp_ledger, icp_minting_account.owner, "icrc1_transfer", args)?;
    
    // Decode the transfer result to verify it succeeded
    let transfer_result: Result<Nat, TransferError> = decode_one(&result)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    match transfer_result {
        Ok(idx) => println!("Mint ICP to User A block index: {}", idx),
        Err(e) => panic!("ICP mint to User A failed: {:?}", e),
    }
    
    ensure_processed(&ic);
    
    // Test 2: Mint ICP tokens to User B
    println!("TEST 2: Minting ICP tokens to User B...");
    
    let icp_amount_b = Nat::from(1_000_000_000_000u64); // 10,000 ICP
    
    let icp_transfer_args = TransferArg {
        from_subaccount: icp_minting_account.subaccount,
        to: user_b_account.clone(),
        amount: icp_amount_b.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let args = encode_one(icp_transfer_args)?;
    let result = pic_update(&ic, icp_ledger, icp_minting_account.owner, "icrc1_transfer", args)?;
    
    // Decode the transfer result to verify it succeeded
    let transfer_result: Result<Nat, TransferError> = decode_one(&result)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    match transfer_result {
        Ok(idx) => println!("Mint ICP to User B block index: {}", idx),
        Err(e) => panic!("ICP mint to User B failed: {:?}", e),
    }
    
    ensure_processed(&ic);
    
    // Test 3: Mint ckUSDT tokens to User A, B, and C
    println!("TEST 3: Minting ckUSDT tokens to Users A, B, and C...");
    
    // Mint to User A
    let ckusdt_amount_a = Nat::from(500_000_000_000u64); // 5,000 ckUSDT
    
    let ckusdt_transfer_args = TransferArg {
        from_subaccount: ckusdt_minting_account.subaccount,
        to: user_a_account.clone(),
        amount: ckusdt_amount_a.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let args = encode_one(ckusdt_transfer_args)?;
    let result = pic_update(&ic, ckusdt_ledger, ckusdt_minting_account.owner, "icrc1_transfer", args)?;
    
    // Decode the transfer result to verify it succeeded
    let transfer_result: Result<Nat, TransferError> = decode_one(&result)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    match transfer_result {
        Ok(idx) => println!("Mint ckUSDT to User A block index: {}", idx),
        Err(e) => panic!("ckUSDT mint to User A failed: {:?}", e),
    }
    
    ensure_processed(&ic);
    
    // Mint to User B
    let ckusdt_amount_b = Nat::from(9_990_000_000_000u64); // 99,900 ckUSDT
    
    let ckusdt_transfer_args = TransferArg {
        from_subaccount: ckusdt_minting_account.subaccount,
        to: user_b_account.clone(),
        amount: ckusdt_amount_b.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let args = encode_one(ckusdt_transfer_args)?;
    let result = pic_update(&ic, ckusdt_ledger, ckusdt_minting_account.owner, "icrc1_transfer", args)?;
    
    // Decode the transfer result to verify it succeeded
    let transfer_result: Result<Nat, TransferError> = decode_one(&result)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    match transfer_result {
        Ok(idx) => println!("Mint ckUSDT to User B block index: {}", idx),
        Err(e) => panic!("ckUSDT mint to User B failed: {:?}", e),
    }
    
    ensure_processed(&ic);
    
    // Mint to User C
    let ckusdt_amount_c = Nat::from(100_000_000_000u64); // 1,000 ckUSDT
    
    let ckusdt_transfer_args = TransferArg {
        from_subaccount: ckusdt_minting_account.subaccount,
        to: user_c_account.clone(),
        amount: ckusdt_amount_c.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let args = encode_one(ckusdt_transfer_args)?;
    let result = pic_update(&ic, ckusdt_ledger, ckusdt_minting_account.owner, "icrc1_transfer", args)?;
    
    // Decode the transfer result to verify it succeeded
    let transfer_result: Result<Nat, TransferError> = decode_one(&result)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    match transfer_result {
        Ok(idx) => println!("Mint ckUSDT to User C block index: {}", idx),
        Err(e) => panic!("ckUSDT mint to User C failed: {:?}", e),
    }
    
    ensure_processed(&ic);
    
    // Test 4: Verify all user balances
    println!("TEST 4: Verifying all user balances...");
    
    // Verify User A balances
    let balance_args = encode_one(user_a_account.clone())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_a_icp_balance: Nat = decode_one(&result)?;
    
    let balance_args = encode_one(user_a_account.clone())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_a_ckusdt_balance: Nat = decode_one(&result)?;
    
    println!("User A ICP balance: {}", user_a_icp_balance);
    println!("User A ckUSDT balance: {}", user_a_ckusdt_balance);
    
    // Assert User A balances match what we minted
    assert_eq!(user_a_icp_balance, icp_amount_a, "User A ICP balance doesn't match minted amount");
    assert_eq!(user_a_ckusdt_balance, ckusdt_amount_a, "User A ckUSDT balance doesn't match minted amount");
    
    // Verify User B balances
    let balance_args = encode_one(user_b_account.clone())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_b_icp_balance: Nat = decode_one(&result)?;
    
    let balance_args = encode_one(user_b_account.clone())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_b_ckusdt_balance: Nat = decode_one(&result)?;
    
    println!("User B ICP balance: {}", user_b_icp_balance);
    println!("User B ckUSDT balance: {}", user_b_ckusdt_balance);
    
    // Assert User B balances match what we minted
    assert_eq!(user_b_icp_balance, icp_amount_b, "User B ICP balance doesn't match minted amount");
    assert_eq!(user_b_ckusdt_balance, ckusdt_amount_b, "User B ckUSDT balance doesn't match minted amount");
    
    // Verify User C balances
    let balance_args = encode_one(user_c_account.clone())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_c_icp_balance: Nat = decode_one(&result)?;
    
    let balance_args = encode_one(user_c_account.clone())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_c_ckusdt_balance: Nat = decode_one(&result)?;
    
    println!("User C ICP balance: {}", user_c_icp_balance);
    println!("User C ckUSDT balance: {}", user_c_ckusdt_balance);
    
    // Assert User C balances - should have 0 ICP and the minted ckUSDT
    assert_eq!(user_c_icp_balance, Nat::from(0u64), "User C ICP balance should be zero");
    assert_eq!(user_c_ckusdt_balance, ckusdt_amount_c, "User C ckUSDT balance doesn't match minted amount");
    
    println!("Minting and balance verification test completed successfully!");
    Ok(())
}