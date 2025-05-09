// src/kong_backend/tests/test_token_transfers.rs
//
// Tests for direct token transfers between users

pub mod common;
mod setup_test_tokens;

use anyhow::Result;
use candid::{decode_one, encode_one, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

use common::pic_ext::{ensure_processed, pic_query, pic_update};
use common::setup::setup_ic_environment;
use common::icrc3_ledger::create_icrc3_ledger;
use common::icrc3_ledger::get_transaction;

/// Test for direct token transfers between users
#[test]
fn test_token_transfers() -> Result<()> {
    println!("Setting up test environment for token transfer test...");

    // Set up test environment with the Kong backend
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    // Get controller from the PocketIc controllers
    let controllers = ic.get_controllers(kong_backend);
    assert!(!controllers.is_empty(), "Failed to get controllers");
    let controller = controllers[0];
    
    // Create user identities with specific byte patterns
    let user_a = Principal::from_slice(&[1, 2, 3, 4, 5]); // Sender
    let user_b = Principal::from_slice(&[6, 7, 8, 9, 10]); // Receiver
    let user_c = Principal::from_slice(&[11, 12, 13, 14, 15]); // Receiver 2
    
    // Print debug info
    println!("Test Debug Info:");
    println!("Controller principal: {}", controller.to_text());
    println!("User A (sender) principal: {}", user_a.to_text());
    println!("User B (receiver) principal: {}", user_b.to_text());
    println!("User C (receiver 2) principal: {}", user_c.to_text());
    println!("Kong backend canister principal: {}", kong_backend.to_text());

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

    // Step 2: Mint tokens to User A (sender)
    println!("STEP 2: Minting tokens to User A (sender)...");
    
    // Mint ICP to User A
    let icp_amount_a = Nat::from(1_000_000_000_000u64); // 10,000 ICP
    
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
    
    // Mint ckUSDT to User A
    let ckusdt_amount_a = Nat::from(5_000_000_000_000u64); // 50,000 ckUSDT
    
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

    // Step 3: Check initial balances
    println!("STEP 3: Checking initial balances...");
    
    // Check User A's ICP balance
    let balance_args = encode_one(user_a_account.clone())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_a_icp_balance_initial: Nat = decode_one(&result)?;
    
    // Check User A's ckUSDT balance
    let balance_args = encode_one(user_a_account.clone())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_a_ckusdt_balance_initial: Nat = decode_one(&result)?;
    
    println!("User A initial ICP balance: {}", user_a_icp_balance_initial);
    println!("User A initial ckUSDT balance: {}", user_a_ckusdt_balance_initial);
    
    // Check User B's ICP balance
    let balance_args = encode_one(user_b_account.clone())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_b_icp_balance_initial: Nat = decode_one(&result)?;
    
    // Check User B's ckUSDT balance
    let balance_args = encode_one(user_b_account.clone())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_b_ckusdt_balance_initial: Nat = decode_one(&result)?;
    
    println!("User B initial ICP balance: {}", user_b_icp_balance_initial);
    println!("User B initial ckUSDT balance: {}", user_b_ckusdt_balance_initial);

    // Step 4: User A transfers ICP to User B
    println!("STEP 4: User A transferring ICP to User B...");
    
    let icp_transfer_amount = Nat::from(100_000_000_000u64); // 1,000 ICP
    let memo_bytes: Vec<u8> = vec![1, 2, 3, 4]; // Example memo
    
    let transfer_args = TransferArg {
        from_subaccount: user_a_account.subaccount,
        to: user_b_account.clone(),
        amount: icp_transfer_amount.clone(),
        fee: None,
        memo: Some(memo_bytes.clone().into()), // Convert Vec<u8> to Memo
        created_at_time: None,
    };

    let args = encode_one(transfer_args)?;
    let result = pic_update(&ic, icp_ledger, user_a, "icrc1_transfer", args)?;
    
    // Decode the transfer result to verify it succeeded
    let transfer_result: Result<Nat, TransferError> = decode_one(&result)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    let icp_transfer_block_index = match transfer_result {
        Ok(idx) => idx,
        Err(e) => panic!("ICP transfer from User A to User B failed: {:?}", e),
    };
    println!("User A transferred ICP to User B, block index: {}", icp_transfer_block_index);
    
    ensure_processed(&ic);

    // Step 5: User A transfers ckUSDT to User C
    println!("STEP 5: User A transferring ckUSDT to User C...");
    
    let ckusdt_transfer_amount = Nat::from(100_000_000_000u64); // 1,000 ckUSDT
    
    let transfer_args = TransferArg {
        from_subaccount: user_a_account.subaccount,
        to: user_c_account.clone(),
        amount: ckusdt_transfer_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let args = encode_one(transfer_args)?;
    let result = pic_update(&ic, ckusdt_ledger, user_a, "icrc1_transfer", args)?;
    
    // Decode the transfer result to verify it succeeded
    let transfer_result: Result<Nat, TransferError> = decode_one(&result)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    let ckusdt_transfer_block_index = match transfer_result {
        Ok(idx) => idx,
        Err(e) => panic!("ckUSDT transfer from User A to User C failed: {:?}", e),
    };
    println!("User A transferred ckUSDT to User C, block index: {}", ckusdt_transfer_block_index);
    
    ensure_processed(&ic);

    // Step 6: Verify final balances
    println!("STEP 6: Verifying final balances...");
    
    // Check User A's ICP balance
    let balance_args = encode_one(user_a_account.clone())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_a_icp_balance_final: Nat = decode_one(&result)?;
    
    // Check User A's ckUSDT balance
    let balance_args = encode_one(user_a_account.clone())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_a_ckusdt_balance_final: Nat = decode_one(&result)?;
    
    println!("User A final ICP balance: {}", user_a_icp_balance_final);
    println!("User A final ckUSDT balance: {}", user_a_ckusdt_balance_final);
    
    // Check User B's ICP balance
    let balance_args = encode_one(user_b_account.clone())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_b_icp_balance_final: Nat = decode_one(&result)?;
    
    println!("User B final ICP balance: {}", user_b_icp_balance_final);
    
    // Check User C's ckUSDT balance
    let balance_args = encode_one(user_c_account.clone())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_c_ckusdt_balance_final: Nat = decode_one(&result)?;
    
    println!("User C final ckUSDT balance: {}", user_c_ckusdt_balance_final);
    
    // Verify User A's balance decreased
    assert!(user_a_icp_balance_final < user_a_icp_balance_initial, 
            "User A's ICP balance should have decreased");
    assert!(user_a_ckusdt_balance_final < user_a_ckusdt_balance_initial, 
            "User A's ckUSDT balance should have decreased");
    
    // Verify User B's ICP balance increased
    assert!(user_b_icp_balance_final > user_b_icp_balance_initial, 
            "User B's ICP balance should have increased");
    
    // Verify User C's ckUSDT balance is correct
    assert_eq!(user_c_ckusdt_balance_final, ckusdt_transfer_amount, 
               "User C's ckUSDT balance doesn't match transfer amount");

    // Step 7: Use ICRC3 API to verify transfer details (memo, etc.)
    println!("STEP 7: Using ICRC3 API to verify transfer details...");
    
    // Get and verify ICP transfer details from ICRC3 API
    let icp_transaction = get_transaction(&ic, icp_ledger, &icp_transfer_block_index)?
        .expect("ICP transaction not found");
    
    println!("ICP transaction details:");
    println!("Kind: {}", icp_transaction.kind);
    println!("Timestamp: {}", icp_transaction.timestamp);
    
    if let Some(transfer) = icp_transaction.transfer {
        println!("From: {}", transfer.from.owner);
        println!("To: {}", transfer.to.owner);
        println!("Amount: {}", transfer.amount);
        if let Some(memo) = transfer.memo {
            println!("Memo: {:?}", memo);
            assert_eq!(memo, memo_bytes, "Memo in transaction doesn't match original memo");
        }
    } else {
        panic!("Expected transfer operation not found in ICP transaction");
    }
    
    // Get and verify ckUSDT transfer details from ICRC3 API
    let ckusdt_transaction = get_transaction(&ic, ckusdt_ledger, &ckusdt_transfer_block_index)?
        .expect("ckUSDT transaction not found");
    
    println!("ckUSDT transaction details:");
    println!("Kind: {}", ckusdt_transaction.kind);
    println!("Timestamp: {}", ckusdt_transaction.timestamp);
    
    if let Some(transfer) = ckusdt_transaction.transfer {
        println!("From: {}", transfer.from.owner);
        println!("To: {}", transfer.to.owner);
        println!("Amount: {}", transfer.amount);
        assert_eq!(transfer.from.owner, user_a, "Sender doesn't match");
        assert_eq!(transfer.to.owner, user_c, "Receiver doesn't match");
        assert_eq!(transfer.amount, ckusdt_transfer_amount, "Amount doesn't match");
    } else {
        panic!("Expected transfer operation not found in ckUSDT transaction");
    }
    
    println!("Token transfer test completed successfully!");
    Ok(())
}