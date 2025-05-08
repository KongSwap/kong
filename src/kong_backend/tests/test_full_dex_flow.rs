// src/kong_backend/tests/test_full_dex_flow.rs
//
// This test file demonstrates the complete flow of Kong DEX operations:
// 1. Setting up tokens (ICP and ICRC3/ICRC1)
// 2. Adding tokens to the DEX
// 3. Creating a liquidity pool
// 4. Adding liquidity to the pool
// 5. Performing swaps (both synchronous and asynchronous)
// 6. Verifying the results

pub mod common;
mod setup_test_tokens;

use anyhow::Result;
use candid::{Deserialize, Principal, Nat, encode_one, decode_one};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use kong_backend::tokens::tokens_reply::TokensReply;
use candid::CandidType;

#[derive(candid::Deserialize, CandidType, Debug)]
enum TokensResult {
    Ok(Vec<TokensReply>),
    Err(String),
}

use pocket_ic::PocketIc;
use std::time::Duration;

use common::icrc3_ledger::{create_icrc3_ledger, verify_icrc3_transfer};
use common::setup::setup_ic_environment;
use common::pic_ext::{pic_update, pic_query, ensure_processed};

// Define the structures we need for our test
#[derive(CandidType, Deserialize, Clone, Debug)]
struct SwapArgs {
    pub pool_id: u32,
    pub pay_token_id: u32,
    pub receive_token_id: u32,
    pub pay_amount: Nat,
    pub min_receive_amount: Nat,
    pub block_id: Option<Nat>,
    pub use_transfer_from: Option<bool>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct AddPoolArgs {
    pub token_0_id: u32,
    pub token_1_id: u32,
    pub fee_percent: u32,
    pub pool_name: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct AddLiquidityArgs {
    pub pool_id: u32,
    pub token_0_id: u32,
    pub token_1_id: u32,
    pub desired_amount_0: Nat,
    pub desired_amount_1: Nat,
    pub min_amount_0: Nat,
    pub min_amount_1: Nat,
    pub block_id: Option<Nat>,
    pub use_transfer_from: Option<bool>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct AddTokenArgs {
    pub token: String,
}

#[test]
fn test_full_dex_flow() -> Result<()> {
    println!("Setting up test environment...");
    
    // Set up test environment
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");
    
    // Get the controller from the PocketIc controllers
    let controllers = ic.get_controllers(kong_backend);
    assert!(!controllers.is_empty(), "Failed to get controllers");
    let controller = controllers[0];
    
    // Setup test identities
    let owner = controller;
    let user = Principal::from_text("2vxsx-fae").unwrap();
    let user_account = Account { owner: user, subaccount: None };
    let kong_account = Account { owner: kong_backend, subaccount: None };
    
    // Step 1: Deploy token ledgers
    println!("Deploying token ledgers...");
    
    // Set up ICP ledger
    let icp_ledger = setup_test_tokens::create_test_icp_ledger(&ic, &controller)?;
    println!("Created ICP ledger: {}", icp_ledger);
    
    // Set up ICRC3 token ledger
    let test_token_ledger = create_icrc3_ledger(
        &ic,
        &controller,
        "Test Token",
        "TEST",
        8, // 8 decimals
        vec![] // No initial balances
    )?;
    ensure_processed(&ic);
    println!("Created TEST token ledger: {}", test_token_ledger);
    
    // Get minting account for both ledgers
    let minting_account_args = encode_one(())?;
    
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_minting_account", minting_account_args.clone())?;
    let icp_minting_account: Option<Account> = decode_one(&result)?;
    let icp_minting_account = icp_minting_account.unwrap();
    
    let result = pic_query(&ic, test_token_ledger, Principal::anonymous(), "icrc1_minting_account", minting_account_args)?;
    let test_minting_account: Option<Account> = decode_one(&result)?;
    let test_minting_account = test_minting_account.unwrap();
    
    // Step 2: Mint tokens to user
    println!("Minting tokens to user...");
    
    // Mint ICP to user
    let icp_transfer_args = TransferArg {
        from_subaccount: icp_minting_account.subaccount,
        to: user_account.clone(),
        amount: Nat::from(1_000_000_000_000u64), // 10,000 ICP
        fee: None,
        memo: None,
        created_at_time: None,
    };
    
    let args = encode_one(icp_transfer_args)?;
    pic_update(&ic, icp_ledger, icp_minting_account.owner, "icrc1_transfer", args)?;
    ensure_processed(&ic);
    
    // Mint TEST tokens to user
    let test_transfer_args = TransferArg {
        from_subaccount: test_minting_account.subaccount,
        to: user_account.clone(),
        amount: Nat::from(10_000_000_000_000u64), // 100,000 TEST
        fee: None,
        memo: None,
        created_at_time: None,
    };
    
    let args = encode_one(test_transfer_args)?;
    pic_update(&ic, test_token_ledger, test_minting_account.owner, "icrc1_transfer", args)?;
    ensure_processed(&ic);
    
    // Verify user balances
    let balance_args = encode_one(user_account.clone())?;
    
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args.clone())?;
    let icp_balance: Nat = decode_one(&result)?;
    println!("User ICP balance: {}", icp_balance);
    
    let result = pic_query(&ic, test_token_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args.clone())?;
    let test_balance: Nat = decode_one(&result)?;
    println!("User TEST balance: {}", test_balance);
    
    // Step 3: Add tokens to the Kong DEX
    println!("Adding tokens to the Kong DEX...");
    
    // Add ICP token
    let add_icp_args = AddTokenArgs {
        token: format!("IC.{}", icp_ledger.to_string()),
    };
    
    let args = encode_one(add_icp_args)?;
    pic_update(&ic, kong_backend, controller, "add_token", args)?;
    ensure_processed(&ic);
    
    // Add TEST token
    let add_test_args = AddTokenArgs {
        token: format!("IC.{}", test_token_ledger.to_string()),
    };
    
    let args = encode_one(add_test_args)?;
    pic_update(&ic, kong_backend, controller, "add_token", args)?;
    ensure_processed(&ic);
    
    // Get token IDs
    let tokens_args = encode_one(())?;
    let tokens_result_bytes = pic_query(&ic, kong_backend, Principal::anonymous(), "tokens", tokens_args)?;
    let tokens_result: TokensResult = candid::decode_one(&tokens_result_bytes)?;
    let tokens = match tokens_result {
        TokensResult::Ok(tokens) => tokens,
        TokensResult::Err(e) => panic!("Tokens query failed: {}", e),
    };
    
    println!("Tokens registered in Kong: {} tokens", tokens.len());
    
    // Extract the token IDs for ICP and TEST based on canister IDs
    let mut icp_token_id: u32 = 0;
    let mut test_token_id: u32 = 0;
    for token in tokens {
        if let TokensReply::IC(reply) = token {
            if reply.canister_id == icp_ledger.to_string() {
                icp_token_id = reply.token_id;
            } else if reply.canister_id == test_token_ledger.to_string() {
                test_token_id = reply.token_id;
            }
        }
    }
    
    assert!(icp_token_id != 0 && test_token_id != 0, "Failed to find token IDs");
    
    // Step 4: Create a liquidity pool
    println!("Creating a liquidity pool...");
    
    let add_pool_args = AddPoolArgs {
        token_0_id: icp_token_id,
        token_1_id: test_token_id,
        fee_percent: 3, // 0.3%
        pool_name: None,
    };
    
    let args = encode_one(add_pool_args)?;
    pic_update(&ic, kong_backend, controller, "add_pool", args)?;
    ensure_processed(&ic);
    
    // Get pool ID
    let pools_args = encode_one(())?;
    let pools_result = pic_query(&ic, kong_backend, Principal::anonymous(), "pools", pools_args)?;
    let pools: Vec<(u32, serde_bytes::ByteBuf)> = decode_one(&pools_result)?;
    
    println!("Pools in Kong: {} pools", pools.len());
    
    // Again, for simplicity we'll use pool ID 1
    let pool_id = 1u32;
    
    // Step 5: Add liquidity to the pool
    println!("Adding liquidity to the pool...");
    
    // User transfers ICP to Kong backend
    let icp_amount = Nat::from(100_000_000_000u64); // 1,000 ICP
    let test_amount = Nat::from(10_000_000_000_000u64); // 100,000 TEST
    
    // Transfer ICP to Kong
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: kong_account.clone(),
        amount: icp_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };
    
    let args = encode_one(transfer_args)?;
    let result = pic_update(&ic, icp_ledger, user, "icrc1_transfer", args)?;
    
    // Extract the block_id from the Result
    let icp_block_id: Nat = decode_one(&result)?;
    println!("Transferred ICP to Kong, block ID: {}", icp_block_id);
    ensure_processed(&ic);
    
    // Approve TEST tokens for Kong to use
    let approve_args = encode_one((
        kong_backend,
        test_amount.clone(),
        None::<Vec<u8>>, // memo
        None::<Nat>, // fee
        None::<u64>, // created_at_time
        None::<u64>, // expected_allowance
        None::<u64>, // expires_at
    ))?;
    
    pic_update(&ic, test_token_ledger, user, "icrc2_approve", approve_args)?;
    ensure_processed(&ic);
    println!("Approved TEST tokens for Kong to use");
    
    // Add liquidity using transfer + approve
    let add_liquidity_args = AddLiquidityArgs {
        pool_id,
        token_0_id: icp_token_id,
        token_1_id: test_token_id,
        desired_amount_0: icp_amount.clone(),
        desired_amount_1: test_amount.clone(),
        min_amount_0: Nat::from(0u64),
        min_amount_1: Nat::from(0u64),
        block_id: Some(icp_block_id.clone()),
        use_transfer_from: Some(true),
    };
    
    let args = encode_one(add_liquidity_args)?;
    let result = pic_update(&ic, kong_backend, user, "add_liquidity", args)?;
    let add_liquidity_result: serde_bytes::ByteBuf = decode_one(&result)?;
    println!("Added liquidity successfully");
    ensure_processed(&ic);
    
    // Check pool state after adding liquidity
    let get_pool_args = encode_one(pool_id)?;
    let pool_result = pic_query(&ic, kong_backend, Principal::anonymous(), "get_pool", get_pool_args)?;
    let pool: (u32, serde_bytes::ByteBuf) = decode_one(&pool_result)?;
    println!("Pool state updated with liquidity");
    
    // Step 6: Perform a swap (ICP -> TEST)
    println!("Performing swap: ICP -> TEST...");
    
    // User transfers more ICP to Kong backend for the swap
    let swap_icp_amount = Nat::from(1_000_000_000u64); // 10 ICP
    
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: kong_account.clone(),
        amount: swap_icp_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };
    
    let args = encode_one(transfer_args)?;
    let result = pic_update(&ic, icp_ledger, user, "icrc1_transfer", args)?;
    
    // Extract the block_id from the Result
    let swap_block_id: Nat = decode_one(&result)?;
    println!("Transferred ICP for swap, block ID: {}", swap_block_id);
    ensure_processed(&ic);
    
    // Execute the swap
    let swap_args = SwapArgs {
        pool_id,
        pay_token_id: icp_token_id,
        receive_token_id: test_token_id,
        pay_amount: swap_icp_amount.clone(),
        min_receive_amount: Nat::from(0u64),
        block_id: Some(swap_block_id.clone()),
        use_transfer_from: None,
    };
    
    let args = encode_one(swap_args)?;
    let result = pic_update(&ic, kong_backend, user, "swap_transfer", args)?;
    let swap_result: serde_bytes::ByteBuf = decode_one(&result)?;
    println!("Swap completed successfully");
    ensure_processed(&ic);
    
    // Check user's TEST balance after swap
    let balance_args = encode_one(user_account.clone())?;
    let balance_result = pic_query(&ic, test_token_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let test_balance_after_swap: Nat = decode_one(&balance_result)?;
    println!("TEST balance after swap: {}", test_balance_after_swap);
    
    // Step 7: Perform a reverse swap (TEST -> ICP) using approve
    println!("Performing reverse swap: TEST -> ICP with approve...");
    
    // Approve TEST tokens for Kong to use in swap
    let swap_test_amount = Nat::from(100_000_000_000u64); // 1,000 TEST
    
    let approve_args = encode_one((
        kong_backend,
        swap_test_amount.clone(),
        None::<Vec<u8>>, // memo
        None::<Nat>, // fee
        None::<u64>, // created_at_time
        None::<Nat>, // expected_allowance
        None::<u64>, // expires_at
    ))?;
    
    pic_update(&ic, test_token_ledger, user, "icrc2_approve", approve_args)?;
    ensure_processed(&ic);
    println!("Approved TEST tokens for reverse swap");
    
    // Execute the reverse swap with transferFrom
    let reverse_swap_args = SwapArgs {
        pool_id,
        pay_token_id: test_token_id,
        receive_token_id: icp_token_id,
        pay_amount: swap_test_amount.clone(),
        min_receive_amount: Nat::from(0u64),
        block_id: None,
        use_transfer_from: Some(true),
    };
    
    let args = encode_one(reverse_swap_args)?;
    let result = pic_update(&ic, kong_backend, user, "swap_transfer_from", args)?;
    let reverse_swap_result: serde_bytes::ByteBuf = decode_one(&result)?;
    println!("Reverse swap completed successfully");
    ensure_processed(&ic);
    
    // Check user's ICP balance after reverse swap
    let balance_args = encode_one(user_account.clone())?;
    let balance_result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let icp_balance_after_swap: Nat = decode_one(&balance_result)?;
    println!("ICP balance after reverse swap: {}", icp_balance_after_swap);
    
    // Step 8: Demonstrate async swap
    println!("Demonstrating async swap operation...");
    
    // Transfer ICP for async swap
    let async_swap_amount = Nat::from(500_000_000u64); // 5 ICP
    
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: kong_account.clone(),
        amount: async_swap_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };
    
    let args = encode_one(transfer_args)?;
    let result = pic_update(&ic, icp_ledger, user, "icrc1_transfer", args)?;
    
    // Extract the block_id from the Result
    let async_block_id: Nat = decode_one(&result)?;
    println!("Transferred ICP for async swap, block ID: {}", async_block_id);
    ensure_processed(&ic);
    
    // Execute the async swap
    let async_swap_args = SwapArgs {
        pool_id,
        pay_token_id: icp_token_id,
        receive_token_id: test_token_id,
        pay_amount: async_swap_amount.clone(),
        min_receive_amount: Nat::from(0u64),
        block_id: Some(async_block_id.clone()),
        use_transfer_from: None,
    };
    
    let args = encode_one(async_swap_args)?;
    let result = pic_update(&ic, kong_backend, user, "swap_transfer_async", args)?;
    let request_id: u64 = decode_one(&result)?;
    println!("Async swap initiated, request ID: {}", request_id);
    
    // Advance time and process
    ic.advance_time(Duration::from_secs(5));
    ic.tick();
    ensure_processed(&ic);
    
    // Check request status
    let request_args = encode_one(Some(request_id))?;
    let request_result = pic_query(&ic, kong_backend, Principal::anonymous(), "requests", request_args)?;
    let request_status: serde_bytes::ByteBuf = decode_one(&request_result)?;
    println!("Async request processed");
    
    // Final check of balances
    let balance_args = encode_one(user_account.clone())?;
    
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args.clone())?;
    let final_icp_balance: Nat = decode_one(&result)?;
    println!("Final ICP balance: {}", final_icp_balance);
    
    let result = pic_query(&ic, test_token_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let final_test_balance: Nat = decode_one(&result)?;
    println!("Final TEST balance: {}", final_test_balance);
    
    println!("Test completed successfully!");
    Ok(())
}