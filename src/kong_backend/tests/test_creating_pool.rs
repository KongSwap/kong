// src/kong_backend/tests/test_creating_pool.rs
//
// Tests for creating a liquidity pool

pub mod common;
mod setup_test_tokens;

use anyhow::Result;
use candid::{decode_one, encode_one, CandidType, Deserialize, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

use common::pic_ext::{ensure_processed, pic_query, pic_update};
use common::setup::setup_ic_environment;
use common::icrc3_ledger::create_icrc3_ledger;

// Define the structures we need for our test
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

#[derive(CandidType, Deserialize)]
enum PoolsResult {
    Ok(Vec<PoolReply>),
    Err(String),
}

#[derive(CandidType, Deserialize, Debug)]
struct PoolReply {
    pool_id: u32,
    token_0: String,
    token_0_amount: Nat,
    token_0_decimals: u8,
    token_0_id: u32,
    token_1: String,
    token_1_amount: Nat,
    token_1_decimals: u8,
    token_1_id: u32,
    lp_token_amount: Nat,
    lp_token_total_supply: Nat,
    lp_fee_bps: u8,
}

/// Test for creating a liquidity pool
#[test]
fn test_creating_pool() -> Result<()> {
    println!("Setting up test environment for creating pool test...");

    // Set up test environment with the Kong backend
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    // Get controller from the PocketIc controllers
    let controllers = ic.get_controllers(kong_backend);
    assert!(!controllers.is_empty(), "Failed to get controllers");
    let controller = controllers[0];
    
    // Create user identity with specific byte pattern for liquidity provider
    let user_b = Principal::from_slice(&[6, 7, 8, 9, 10]); // Liquidity provider
    
    // Print debug info
    println!("Test Debug Info:");
    println!("Controller principal: {}", controller.to_text());
    println!("User B (liquidity provider) principal: {}", user_b.to_text());
    println!("Kong backend canister principal: {}", kong_backend.to_text());

    // Always use an explicit [0;32] for the default subaccount to match Kong's verifier
    let zero_sub = Some([0u8; 32]);
    
    // Set up accounts with explicit zero subaccounts
    let user_b_account = Account {
        owner: user_b,
        subaccount: zero_sub,
    };
    
    let kong_account = Account {
        owner: kong_backend,
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

    // Step 2: Mint tokens to User B (liquidity provider)
    println!("STEP 2: Minting tokens to User B (liquidity provider)...");
    
    // Mint ICP to User B
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
    
    // Mint ckUSDT to User B
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

    // Step 3: Add tokens to the Kong DEX
    println!("STEP 3: Adding tokens to Kong DEX...");
    
    // Add ICP token
    let add_icp_args = AddTokenArgs {
        token: format!("IC.{}", icp_ledger.to_string()),
    };

    let args = encode_one(add_icp_args)?;
    pic_update(&ic, kong_backend, controller, "add_token", args)?;
    ensure_processed(&ic);
    println!("Added ICP token to Kong DEX");
    
    // Add ckUSDT token
    let add_ckusdt_args = AddTokenArgs {
        token: format!("IC.{}", ckusdt_ledger.to_string()),
    };

    let args = encode_one(add_ckusdt_args)?;
    pic_update(&ic, kong_backend, controller, "add_token", args)?;
    ensure_processed(&ic);
    println!("Added ckUSDT token to Kong DEX");

    // Step 4: Query token details from Kong DEX
    println!("STEP 4: Querying token details from Kong DEX...");
    let tokens_args = encode_one(())?;
    let tokens_result_bytes = pic_query(&ic, kong_backend, Principal::anonymous(), "tokens", tokens_args)?;
    let tokens_result: TokensResult = decode_one(&tokens_result_bytes)?;
    
    let tokens = match tokens_result {
        TokensResult::Ok(tokens) => tokens,
        TokensResult::Err(e) => panic!("Tokens query failed: {}", e),
    };

    println!("Tokens in Kong DEX: {} tokens", tokens.len());
    
    // Extract the token IDs for ICP and ckUSDT based on canister IDs
    let mut icp_token_id: u32 = 0;
    let mut ckusdt_token_id: u32 = 0;
    for token in tokens {
        if let TokensReply::IC(reply) = token {
            if reply.canister_id == icp_ledger.to_string() {
                icp_token_id = reply.token_id;
                println!("Found ICP token ID: {}", icp_token_id);
            } else if reply.canister_id == ckusdt_ledger.to_string() {
                ckusdt_token_id = reply.token_id;
                println!("Found ckUSDT token ID: {}", ckusdt_token_id);
            }
        }
    }

    assert!(icp_token_id != 0 && ckusdt_token_id != 0, "Failed to find token IDs");

    // Step 5: User B transfers tokens to Kong for pool creation
    println!("STEP 5: User B transferring tokens to Kong for pool creation...");
    
    // Initial amounts for pool creation
    let initial_icp_amount = Nat::from(100_000_000_000u64); // 1,000 ICP
    let initial_ckusdt_amount = Nat::from(10_000_000_000_000u64); // 100,000 ckUSDT
    
    // User B transfers ICP to Kong backend for pool creation
    let current_time_u64 = ic.get_time().as_nanos_since_unix_epoch();
    println!("Current IC time (ns): {}", current_time_u64);
    
    let transfer_args_icp = TransferArg {
        from_subaccount: user_b_account.subaccount,
        to: kong_account.clone(),
        amount: initial_icp_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(current_time_u64),
    };

    let args_icp = encode_one(transfer_args_icp)?;
    println!("User B transferring ICP to Kong for pool creation");
    let result_bytes_icp = pic_update(&ic, icp_ledger, user_b, "icrc1_transfer", args_icp)?;
    let transfer_outcome_icp: Result<Nat, TransferError> = decode_one(&result_bytes_icp)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    let icp_tx_id = match transfer_outcome_icp {
        Ok(block_index) => TxId::BlockIndex(block_index),
        Err(e) => panic!("icrc1_transfer (ICP to Kong) failed: {:?}", e),
    };
    println!("User B transferred ICP to Kong, tx_id: {:?}", icp_tx_id);
    
    // Multiple ticks to ensure the transaction is finalized
    ic.tick();
    ensure_processed(&ic);
    
    // User B transfers ckUSDT to Kong backend for pool creation
    let current_time_u64 = ic.get_time().as_nanos_since_unix_epoch();
    println!("Current IC time for ckUSDT transfer (ns): {}", current_time_u64);
    
    let transfer_args_ckusdt = TransferArg {
        from_subaccount: user_b_account.subaccount,
        to: kong_account.clone(),
        amount: initial_ckusdt_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(current_time_u64),
    };

    let args_ckusdt = encode_one(transfer_args_ckusdt)?;
    println!("User B transferring ckUSDT to Kong for pool creation");
    let result_bytes_ckusdt = pic_update(&ic, ckusdt_ledger, user_b, "icrc1_transfer", args_ckusdt)?;
    let transfer_outcome_ckusdt: Result<Nat, TransferError> = decode_one(&result_bytes_ckusdt)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    let ckusdt_tx_id = match transfer_outcome_ckusdt {
        Ok(block_index) => TxId::BlockIndex(block_index),
        Err(e) => panic!("icrc1_transfer (ckUSDT to Kong) failed: {:?}", e),
    };
    println!("User B transferred ckUSDT to Kong, tx_id: {:?}", ckusdt_tx_id);
    
    // Multiple ticks to ensure the transaction is finalized
    for _ in 0..5 {
        ic.tick();
        ensure_processed(&ic);
    }
    
    // Step 6: User B creates the pool
    println!("STEP 6: User B creating pool with transferred tokens...");
    
    let add_pool_args = AddPoolArgs {
        token_0: format!("IC.{}", icp_ledger.to_string()),
        amount_0: initial_icp_amount.clone(),
        tx_id_0: Some(icp_tx_id),
        token_1: format!("IC.{}", ckusdt_ledger.to_string()),
        amount_1: initial_ckusdt_amount.clone(),
        tx_id_1: Some(ckusdt_tx_id),
        lp_fee_bps: Some(3), // 0.3%
    };

    let args = encode_one(add_pool_args)?;
    println!("User B sending add_pool request");
    let result = pic_update(&ic, kong_backend, user_b, "add_pool", args)?;
    let _: () = decode_one(&result)?;
    println!("Pool created successfully");
    ensure_processed(&ic);

    // Step 7: Query and verify pool was created correctly
    println!("STEP 7: Querying and verifying created pool...");
    let get_pool_args = encode_one(None as Option<String>)?; // Get all pools
    let pool_result = pic_query(&ic, kong_backend, Principal::anonymous(), "pools", get_pool_args)?;
    let pool_result: PoolsResult = decode_one(&pool_result)
        .map_err(|e| anyhow::anyhow!("Failed to decode pools response: {}", e))?;
    
    let pools = match pool_result {
        PoolsResult::Ok(p) => p,
        PoolsResult::Err(e) => panic!("Pool query failed: {}", e),
    };
    
    println!("Found {} pools in Kong DEX", pools.len());
    assert!(!pools.is_empty(), "No pools found in Kong DEX");
    
    // Assume the first pool is the one we just created (pool_id = 1)
    let pool_id = 1u32;
    let pool = pools.into_iter()
        .find(|p| p.pool_id == pool_id)
        .expect("Pool not found");
    
    println!("Verified pool details:");
    println!("Pool ID: {}", pool.pool_id);
    println!("Token 0 (ICP) amount: {}", pool.token_0_amount);
    println!("Token 1 (ckUSDT) amount: {}", pool.token_1_amount);
    println!("LP token total supply: {}", pool.lp_token_total_supply);
    println!("LP fee (bps): {}", pool.lp_fee_bps);
    
    // Verify pool token amounts and fee match what we set
    assert_eq!(pool.token_0_amount, initial_icp_amount, "Pool ICP amount doesn't match");
    assert_eq!(pool.token_1_amount, initial_ckusdt_amount, "Pool ckUSDT amount doesn't match");
    assert_eq!(pool.lp_fee_bps, 3, "Pool LP fee doesn't match");
    
    println!("Creating pool test completed successfully!");
    Ok(())
}