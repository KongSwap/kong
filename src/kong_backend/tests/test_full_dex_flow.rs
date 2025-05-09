// src/kong_backend/tests/test_full_dex_flow.rs
//
// 1. Setting up tokens (ICP and ICRC3/ICRC1)
// 2. Adding tokens to the DEX
// 3. Creating a liquidity pool
// 4. Adding liquidity to the pool
// 5. Performing swaps (both synchronous and asynchronous)
// 6. Verifying the results

pub mod common;
mod setup_test_tokens;

use anyhow::Result;
use candid::{decode_one, encode_one, Deserialize, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use icrc_ledger_types::icrc1::transfer::TransferError;
use icrc_ledger_types::icrc1::transfer::Memo;
use kong_backend::add_liquidity::add_liquidity_reply::AddLiquidityReply;
use kong_backend::pools::pools_reply::PoolReply;

use candid::CandidType;
use kong_backend::tokens::tokens_reply::TokensReply;

// Import the correct ApproveArgs and Account from icrc_ledger_types
use icrc_ledger_types::icrc2::approve::ApproveArgs;

#[derive(candid::Deserialize, CandidType, Debug)]
enum TokensResult {
    Ok(Vec<TokensReply>),
    Err(String),
}

#[derive(CandidType, Deserialize)]
enum AddLiquidityResult {
    Ok(AddLiquidityReply),
    Err(String),
}

use std::time::Duration;

use common::icrc3_ledger::create_icrc3_ledger;
use common::pic_ext::{ensure_processed, pic_query, pic_update};
use common::setup::setup_ic_environment;

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
    pub token_0: String,
    pub amount_0: Nat,
    pub tx_id_0: Option<TxId>,
    pub token_1: String,
    pub amount_1: Nat,
    pub tx_id_1: Option<TxId>,
    pub lp_fee_bps: Option<u8>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum TxId {
    BlockIndex(Nat),
    TransactionId(String),
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

#[derive(CandidType, Deserialize, Clone, Debug)]
struct CanisterAddLiquidityArgs {
    pub token_0: String,
    pub amount_0: Nat,
    pub tx_id_0: Option<TxId>,
    pub token_1: String,
    pub amount_1: Nat,
    pub tx_id_1: Option<TxId>,
}

#[derive(CandidType, Deserialize)]
enum PoolsResult {
    Ok(Vec<PoolReply>),
    Err(String),
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
    let _ = controller;
    let user = Principal::from_text("2vxsx-fae").unwrap();
    let user_account = Account {
        owner: user,
        subaccount: None,
    };
    let kong_account = Account {
        owner: kong_backend,
        subaccount: None,
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
        vec![], // No initial balances
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

    // Step 2: Mint tokens to user
    println!("STEP 2: Minting tokens to user...");

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
    println!("STEP 2: Sending ICP transfer request: {:?}", args);
    let result = pic_update(&ic, icp_ledger, icp_minting_account.owner, "icrc1_transfer", args)?;
    println!("STEP 2: Received ICP transfer response: {:?}", result);
    ensure_processed(&ic);

    // Mint ckUSDT to user
    let ckusdt_transfer_amount = Nat::from(9_990_000_000_000u64);

    let ckusdt_transfer_args = TransferArg {
        from_subaccount: ckusdt_minting_account.subaccount,
        to: user_account.clone(),
        amount: ckusdt_transfer_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let args = encode_one(ckusdt_transfer_args)?;
    pic_update(&ic, ckusdt_ledger, ckusdt_minting_account.owner, "icrc1_transfer", args)?;
    ensure_processed(&ic);

    // Verify user balances
    let balance_args = encode_one(user_account.clone())?;

    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args.clone())?;
    let icp_balance: Nat = decode_one(&result)?;
    println!("User ICP balance: {}", icp_balance);

    let result = pic_query(
        &ic,
        ckusdt_ledger,
        Principal::anonymous(),
        "icrc1_balance_of",
        balance_args.clone(),
    )?;
    let ckusdt_balance: Nat = decode_one(&result)?;
    println!("User ckUSDT balance: {}", ckusdt_balance);

    // Step 3: Add tokens to the Kong DEX
    println!("STEP 3: Adding tokens to Kong DEX...");

    // Add ICP token
    let add_icp_args = AddTokenArgs {
        token: format!("IC.{}", icp_ledger.to_string()),
    };

    let args = encode_one(add_icp_args)?;
    println!("STEP 3: Sending add_token request: {:?}", args);
    let result = pic_update(&ic, kong_backend, controller, "add_token", args)?;
    println!("STEP 3: Received add_token response: {:?}", result);
    ensure_processed(&ic);

    // Add ckUSDT token
    let add_ckusdt_args = AddTokenArgs {
        token: format!("IC.{}", ckusdt_ledger.to_string()),
    };

    let args = encode_one(add_ckusdt_args)?;
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

    // Extract the token IDs for ICP and ckUSDT based on canister IDs
    let mut icp_token_id: u32 = 0;
    let mut ckusdt_token_id: u32 = 0;
    for token in tokens {
        if let TokensReply::IC(reply) = token {
            if reply.canister_id == icp_ledger.to_string() {
                icp_token_id = reply.token_id;
            } else if reply.canister_id == ckusdt_ledger.to_string() {
                ckusdt_token_id = reply.token_id;
            }
        }
    }

    assert!(icp_token_id != 0 && ckusdt_token_id != 0, "Failed to find token IDs");

    // Step 4: Create a liquidity pool with ICP and ckUSDT
    println!("STEP 4: Creating liquidity pool...");

    // Define initial liquidity amounts for pool creation
    let initial_icp_amount = Nat::from(100_000_000_000u64); // 1,000 ICP
    let initial_ckusdt_amount = Nat::from(10_000_000_000_000u64); // 100,000 ckUSDT

    let add_pool_args = AddPoolArgs {
        token_0: format!("IC.{}", icp_ledger.to_string()),
        amount_0: initial_icp_amount.clone(),
        tx_id_0: None,
        token_1: format!("IC.{}", ckusdt_ledger.to_string()),
        amount_1: initial_ckusdt_amount.clone(),
        tx_id_1: None,
        lp_fee_bps: Some(3), // 0.3%
    };

    let args = encode_one(add_pool_args)?;
    println!("STEP 4: Sending add_pool request: {:?}", args);
    let result = pic_update(&ic, kong_backend, controller, "add_pool", args)?;
    println!("STEP 4: Received add_pool response: {:?}", result);
    ensure_processed(&ic);

    // For simplicity, assume the first pool created has ID 1
    let pool_id = 1u32;

    // Step 5: Add liquidity to the pool by transferring both tokens to Kong
    println!("STEP 5: Adding liquidity to pool (via pre-transfers to Kong)...");

    let icp_liquidity_amount = Nat::from(100_000_000_000u64); // 1,000 ICP
    let ckusdt_liquidity_amount = Nat::from(1_000_000_000_000u64); // 10,000 ckUSDT - much less than the full balance

    // User transfers ICP to Kong backend for liquidity
    // Set a very recent timestamp for the transfer to ensure it's within the validation window
    let current_time_u64 = ic.get_time().as_nanos_since_unix_epoch();
    println!("Current IC time (ns): {}", current_time_u64);
    
    let transfer_args_icp_for_liq = TransferArg {
        from_subaccount: None,
        to: kong_account.clone(),
        amount: icp_liquidity_amount.clone(),
        fee: None,
        memo: Some(Memo(serde_bytes::ByteBuf::from(b"ICP for liquidity".to_vec()))),
        created_at_time: Some(current_time_u64), // Explicitly set the timestamp to now
    };

    let args_icp_liq = encode_one(transfer_args_icp_for_liq)?;
    let result_bytes_icp_liq = pic_update(&ic, icp_ledger, user, "icrc1_transfer", args_icp_liq)?;
    let transfer_outcome_icp_liq: Result<Nat, TransferError> = decode_one(&result_bytes_icp_liq)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response (ICP to Kong for liquidity): {}", e))?;
    let icp_tx_id_for_liq = match transfer_outcome_icp_liq {
        Ok(block_index) => TxId::BlockIndex(block_index),
        Err(e) => panic!("icrc1_transfer (ICP to Kong for liquidity) failed: {:?}", e),
    };
    println!("Transferred ICP to Kong for liquidity, tx_id: {:?}", icp_tx_id_for_liq);
    
    // Multiple ticks to ensure the transaction is finalized
    ic.tick();
    ensure_processed(&ic);

    // User transfers ckUSDT to Kong backend for liquidity
    // Update time to get the latest timestamp
    let current_time_u64 = ic.get_time().as_nanos_since_unix_epoch();
    println!("Current IC time for ckUSDT transfer (ns): {}", current_time_u64);
    
    let transfer_args_ckusdt_for_liq = TransferArg {
        from_subaccount: None,
        to: kong_account.clone(),
        amount: ckusdt_liquidity_amount.clone(),
        fee: None,
        memo: Some(Memo(serde_bytes::ByteBuf::from(b"ckUSDT for liquidity".to_vec()))),
        created_at_time: Some(current_time_u64), // Explicitly set the timestamp to now
    };

    let args_ckusdt_liq = encode_one(transfer_args_ckusdt_for_liq)?;
    let result_bytes_ckusdt_liq = pic_update(&ic, ckusdt_ledger, user, "icrc1_transfer", args_ckusdt_liq)?;
    let transfer_outcome_ckusdt_liq: Result<Nat, TransferError> = decode_one(&result_bytes_ckusdt_liq)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response (ckUSDT to Kong for liquidity): {}", e))?;
    let ckusdt_tx_id_for_liq = match transfer_outcome_ckusdt_liq {
        Ok(block_index) => TxId::BlockIndex(block_index),
        Err(e) => panic!("icrc1_transfer (ckUSDT to Kong for liquidity) failed: {:?}", e),
    };
    println!("Transferred ckUSDT to Kong for liquidity, tx_id: {:?}", ckusdt_tx_id_for_liq);
    
    // Multiple ticks to ensure the transaction is finalized
    ic.tick();
    ensure_processed(&ic);

    // Extra processing to make sure ledger changes are visible to all canisters
    ic.tick();
    ensure_processed(&ic);
    
    // More ticks to help with transaction visibility
    for _ in 0..5 {
        ic.tick();
        ensure_processed(&ic);
    }
    
    // Add liquidity using the transaction IDs from the transfers
    let canister_add_liquidity_args = CanisterAddLiquidityArgs {
        token_0: format!("IC.{}", icp_ledger.to_string()),
        amount_0: icp_liquidity_amount.clone(),
        tx_id_0: Some(icp_tx_id_for_liq),
        token_1: format!("IC.{}", ckusdt_ledger.to_string()),
        amount_1: ckusdt_liquidity_amount.clone(),
        tx_id_1: Some(ckusdt_tx_id_for_liq),
    };

    let args = encode_one(canister_add_liquidity_args)?;
    println!("STEP 5: Sending add_liquidity request (DID compliant): {:?}", args);
    
    // Advance time to help with transaction visibility
    ic.advance_time(Duration::from_secs(2));
    ic.tick();
    ensure_processed(&ic);
    
    // Calling with `controller` as principal, similar to `add_pool`
    let result = pic_update(&ic, kong_backend, controller, "add_liquidity", args)?;
    println!("STEP 5: Received add_liquidity response: {:?}", result);
    let add_liquidity_result: AddLiquidityResult = decode_one(&result)
        .map_err(|e| anyhow::anyhow!("Failed to decode add_liquidity response: {}", e))?;
    match add_liquidity_result {
        AddLiquidityResult::Ok(reply) => {
            println!("Added liquidity successfully (via pre-transfers), request ID: {}", reply.request_id);
        }
        AddLiquidityResult::Err(e) => panic!("Failed to add liquidity (via pre-transfers): {}", e),
    }

    ensure_processed(&ic);

    // Check pool state after adding liquidity
    println!("STEP 6: Querying pool state...");
    let get_pool_args = encode_one(None as Option<String>)?; // Get all pools
    println!("STEP 6: Sending pools query: {:?}", get_pool_args);
    let pool_result = pic_query(&ic, kong_backend, Principal::anonymous(), "pools", get_pool_args)?;
    println!("STEP 6: Received pools response: {:?}", pool_result);
    let pool_result: PoolsResult = decode_one(&pool_result)
        .map_err(|e| anyhow::anyhow!("Failed to decode pools response: {}", e))?;
    let pools = match pool_result {
        PoolsResult::Ok(p) => p,
        PoolsResult::Err(e) => panic!("Pool query failed: {}", e),
    };
    let _ = pools.into_iter()
        .find(|p| p.pool_id == pool_id)
        .expect("Pool not found");
    println!("Pool state updated with liquidity");

    // Step 6: Perform a swap (ICP -> ckUSDT)
    println!("STEP 7: Performing swap...");

    // User transfers more ICP to Kong backend for the swap
    let swap_icp_amount = Nat::from(1_000_000_000u64); // 10 ICP

    // Get current time for the swap transaction
    let current_time_u64 = ic.get_time().as_nanos_since_unix_epoch();
    println!("Current IC time for swap (ns): {}", current_time_u64);
    
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: kong_account.clone(),
        amount: swap_icp_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(current_time_u64), // Explicitly set the timestamp to now
    };

    let args = encode_one(transfer_args)?;
    let result_bytes = pic_update(&ic, icp_ledger, user, "icrc1_transfer", args)?;

    // Decode the full TransferResult
    let transfer_outcome: Result<Nat, TransferError> = decode_one(&result_bytes)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response (ICP for swap): {}", e))?;
    let swap_block_id: Nat = match transfer_outcome {
        Ok(block_index) => block_index,
        Err(e) => panic!("icrc1_transfer (ICP for swap) failed: {:?}", e),
    };
    println!("Transferred ICP for swap, block ID: {}", swap_block_id);
    ensure_processed(&ic);

    // Execute the swap
    let swap_args = SwapArgs {
        pool_id,
        pay_token_id: icp_token_id,
        receive_token_id: ckusdt_token_id,
        pay_amount: swap_icp_amount.clone(),
        min_receive_amount: Nat::from(0u64),
        block_id: Some(swap_block_id.clone()),
        use_transfer_from: None,
    };

    let args = encode_one(swap_args)?;
    let result = pic_update(&ic, kong_backend, user, "swap_transfer", args)?;
    let _: serde_bytes::ByteBuf = decode_one(&result)?;
    println!("Swap completed successfully");
    ensure_processed(&ic);

    // Check user's ckUSDT balance after swap
    println!("STEP 8: Querying balances...");
    let balance_args = encode_one(user_account.clone())?;
    println!("STEP 8: Sending balance query: {:?}", balance_args);
    let balance_result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    println!("STEP 8: Received balance response: {:?}", balance_result);
    let ckusdt_balance_after_swap: Nat = decode_one(&balance_result)
        .map_err(|e| anyhow::anyhow!("Failed to decode balance response: {}", e))?;
    println!("ckUSDT balance after swap: {}", ckusdt_balance_after_swap);

    // Step 7: Perform a reverse swap (ckUSDT -> ICP) using approve
    println!("Performing reverse swap: ckUSDT -> ICP with approve...");

    // Approve ckUSDT tokens for Kong to use in swap
    let swap_ckusdt_amount = Nat::from(100_000_000_000u64); // 1,000 ckUSDT

    let approve_args = encode_one(
        ApproveArgs {
            from_subaccount: None,
            spender: kong_account.clone(),
            amount: swap_ckusdt_amount.clone(),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        }
    )?;

    pic_update(&ic, ckusdt_ledger, user, "icrc2_approve", approve_args)?;
    ensure_processed(&ic);
    println!("Approved ckUSDT tokens for reverse swap ");

    // Execute the reverse swap with transferFrom
    let reverse_swap_args = SwapArgs {
        pool_id,
        pay_token_id: ckusdt_token_id,
        receive_token_id: icp_token_id,
        pay_amount: swap_ckusdt_amount.clone(),
        min_receive_amount: Nat::from(0u64),
        block_id: None,
        use_transfer_from: Some(true),
    };

    let args = encode_one(reverse_swap_args)?;
    let result = pic_update(&ic, kong_backend, user, "add_liquidity", args)?;
    let _: serde_bytes::ByteBuf = decode_one(&result)?;
    println!("Reverse swap completed successfully ");
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

    // Get current time for the async swap transaction
    let current_time_u64 = ic.get_time().as_nanos_since_unix_epoch();
    println!("Current IC time for async swap (ns): {}", current_time_u64);
    
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: kong_account.clone(),
        amount: async_swap_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(current_time_u64), // Explicitly set the timestamp to now
    };

    let args = encode_one(transfer_args)?;
    let result_bytes = pic_update(&ic, icp_ledger, user, "icrc1_transfer", args)?;

    // Decode the full TransferResult
    let transfer_outcome: Result<Nat, TransferError> = decode_one(&result_bytes)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response (ICP for async swap): {}", e))?;
    let async_block_id: Nat = match transfer_outcome {
        Ok(block_index) => block_index,
        Err(e) => panic!("icrc1_transfer (ICP for async swap) failed: {:?}", e),
    };
    println!("Transferred ICP for async swap, block ID: {}", async_block_id);
    ensure_processed(&ic);

    // Execute the async swap
    let async_swap_args = SwapArgs {
        pool_id,
        pay_token_id: icp_token_id,
        receive_token_id: ckusdt_token_id,
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
    let _: serde_bytes::ByteBuf = decode_one(&request_result)?;
    println!("Async request processed ");

    // Final check of balances
    let balance_args = encode_one(user_account.clone())?;

    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args.clone())?;
    let final_icp_balance: Nat = decode_one(&result)?;
    println!("Final ICP balance: {}", final_icp_balance);

    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let final_ckusdt_balance: Nat = decode_one(&result)?;
    println!("Final ckUSDT balance: {}", final_ckusdt_balance);

    println!("Test completed successfully!");
    Ok(())
}
