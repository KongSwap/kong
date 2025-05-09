// src/kong_backend/tests/test_performing_swaps.rs
//
// Tests for performing token swaps (token A to token B)

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

/// Test for performing token swaps (token A to token B)
#[test]
fn test_performing_swaps() -> Result<()> {
    println!("Setting up test environment for token swap test...");

    // Set up test environment with the Kong backend
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    // Get controller from the PocketIc controllers
    let controllers = ic.get_controllers(kong_backend);
    assert!(!controllers.is_empty(), "Failed to get controllers");
    let controller = controllers[0];
    
    // Create user identities with specific byte patterns
    let user_a = Principal::from_slice(&[1, 2, 3, 4, 5]); // Liquidity provider
    let user_b = Principal::from_slice(&[6, 7, 8, 9, 10]); // Trader
    
    // Print debug info
    println!("Test Debug Info:");
    println!("Controller principal: {}", controller.to_text());
    println!("User A (liquidity provider) principal: {}", user_a.to_text());
    println!("User B (trader) principal: {}", user_b.to_text());
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

    // Step 2: Mint tokens to users
    println!("STEP 2: Minting tokens to users...");
    
    // Mint ICP to User A (liquidity provider)
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
    
    // Mint ICP to User B (trader)
    let icp_amount_b = Nat::from(100_000_000_000u64); // 1,000 ICP
    
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

    // Step 5: User A creates the liquidity pool
    println!("STEP 5: User A creating liquidity pool...");
    
    // Define initial liquidity amounts for pool creation
    let initial_icp_amount = Nat::from(500_000_000_000u64); // 5,000 ICP
    let initial_ckusdt_amount = Nat::from(2_500_000_000_000u64); // 25,000 ckUSDT
    
    // User A transfers ICP to Kong backend for pool creation
    let current_time_u64 = ic.get_time().as_nanos_since_unix_epoch();
    println!("Current IC time (ns): {}", current_time_u64);
    
    let transfer_args_icp = TransferArg {
        from_subaccount: user_a_account.subaccount,
        to: kong_account.clone(),
        amount: initial_icp_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(current_time_u64),
    };

    let args_icp = encode_one(transfer_args_icp)?;
    println!("User A transferring ICP to Kong for pool creation");
    let result_bytes_icp = pic_update(&ic, icp_ledger, user_a, "icrc1_transfer", args_icp)?;
    let transfer_outcome_icp: Result<Nat, TransferError> = decode_one(&result_bytes_icp)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    let icp_tx_id = match transfer_outcome_icp {
        Ok(block_index) => TxId::BlockIndex(block_index),
        Err(e) => panic!("icrc1_transfer (ICP to Kong) failed: {:?}", e),
    };
    println!("User A transferred ICP to Kong, tx_id: {:?}", icp_tx_id);
    
    // Multiple ticks to ensure the transaction is finalized
    ic.tick();
    ensure_processed(&ic);
    
    // User A transfers ckUSDT to Kong backend for pool creation
    let current_time_u64 = ic.get_time().as_nanos_since_unix_epoch();
    println!("Current IC time for ckUSDT transfer (ns): {}", current_time_u64);
    
    let transfer_args_ckusdt = TransferArg {
        from_subaccount: user_a_account.subaccount,
        to: kong_account.clone(),
        amount: initial_ckusdt_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(current_time_u64),
    };

    let args_ckusdt = encode_one(transfer_args_ckusdt)?;
    println!("User A transferring ckUSDT to Kong for pool creation");
    let result_bytes_ckusdt = pic_update(&ic, ckusdt_ledger, user_a, "icrc1_transfer", args_ckusdt)?;
    let transfer_outcome_ckusdt: Result<Nat, TransferError> = decode_one(&result_bytes_ckusdt)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response: {}", e))?;
    let ckusdt_tx_id = match transfer_outcome_ckusdt {
        Ok(block_index) => TxId::BlockIndex(block_index),
        Err(e) => panic!("icrc1_transfer (ckUSDT to Kong) failed: {:?}", e),
    };
    println!("User A transferred ckUSDT to Kong, tx_id: {:?}", ckusdt_tx_id);
    
    // Multiple ticks to ensure the transaction is finalized
    for _ in 0..5 {
        ic.tick();
        ensure_processed(&ic);
    }
    
    // Create the pool
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
    println!("User A sending add_pool request");
    let result = pic_update(&ic, kong_backend, user_a, "add_pool", args)?;
    let _: () = decode_one(&result)?;
    println!("Pool created successfully by User A");
    ensure_processed(&ic);
    
    // For simplicity, assume the first pool created has ID 1
    let pool_id = 1u32;

    // Query initial pool state
    let get_pool_args = encode_one(None as Option<String>)?; // Get all pools
    let pool_result = pic_query(&ic, kong_backend, Principal::anonymous(), "pools", get_pool_args)?;
    let pool_result: PoolsResult = decode_one(&pool_result)
        .map_err(|e| anyhow::anyhow!("Failed to decode pools response: {}", e))?;
    
    let pools = match pool_result {
        PoolsResult::Ok(p) => p,
        PoolsResult::Err(e) => panic!("Pool query failed: {}", e),
    };
    
    let initial_pool = pools.into_iter()
        .find(|p| p.pool_id == pool_id)
        .expect("Pool not found");
    
    println!("Initial pool state:");
    println!("Token 0 (ICP) amount: {}", initial_pool.token_0_amount);
    println!("Token 1 (ckUSDT) amount: {}", initial_pool.token_1_amount);
    println!("LP token total supply: {}", initial_pool.lp_token_total_supply);

    // Step 6: Check initial balances for User B
    println!("STEP 6: Checking initial balances for User B...");
    
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
    
    // Step 7: User B performs swap (ICP -> ckUSDT)
    println!("STEP 7: User B performing swap (ICP -> ckUSDT)...");
    
    // User B transfers ICP to Kong backend for the swap
    let swap_icp_amount = Nat::from(10_000_000_000u64); // 100 ICP
    
    // Get current time for the swap transaction
    let current_time_u64 = ic.get_time().as_nanos_since_unix_epoch();
    println!("Current IC time for swap (ns): {}", current_time_u64);
    
    let transfer_args = TransferArg {
        from_subaccount: user_b_account.subaccount,
        to: kong_account.clone(),
        amount: swap_icp_amount.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(current_time_u64),
    };

    let args = encode_one(transfer_args)?;
    println!("User B transferring ICP to Kong for swap");
    let result_bytes = pic_update(&ic, icp_ledger, user_b, "icrc1_transfer", args)?;

    // Decode the full TransferResult
    let transfer_outcome: Result<Nat, TransferError> = decode_one(&result_bytes)
        .map_err(|e| anyhow::anyhow!("Failed to decode icrc1_transfer response (ICP for swap): {}", e))?;
    let swap_block_id: Nat = match transfer_outcome {
        Ok(block_index) => block_index,
        Err(e) => panic!("icrc1_transfer (ICP for swap) failed: {:?}", e),
    };
    println!("User B transferred ICP for swap, block ID: {}", swap_block_id);
    ensure_processed(&ic);

    // User B executes the swap
    let swap_args = SwapArgs {
        pool_id,
        pay_token_id: icp_token_id,
        receive_token_id: ckusdt_token_id,
        pay_amount: swap_icp_amount.clone(),
        min_receive_amount: Nat::from(0u64), // No minimum (not safe for production!)
        block_id: Some(swap_block_id.clone()),
        use_transfer_from: None,
    };

    let args = encode_one(swap_args)?;
    println!("User B executing swap_transfer");
    let result = pic_update(&ic, kong_backend, user_b, "swap_transfer", args)?;
    let _: serde_bytes::ByteBuf = decode_one(&result)?;
    println!("User B's swap completed successfully");
    ensure_processed(&ic);

    // Step 8: Verify balances after swap
    println!("STEP 8: Verifying balances after swap...");
    
    // Check User B's ICP balance after swap
    let balance_args = encode_one(user_b_account.clone())?;
    let result = pic_query(&ic, icp_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_b_icp_balance_after: Nat = decode_one(&result)?;
    
    // Check User B's ckUSDT balance after swap
    let balance_args = encode_one(user_b_account.clone())?;
    let result = pic_query(&ic, ckusdt_ledger, Principal::anonymous(), "icrc1_balance_of", balance_args)?;
    let user_b_ckusdt_balance_after: Nat = decode_one(&result)?;
    
    println!("User B ICP balance after swap: {}", user_b_icp_balance_after);
    println!("User B ckUSDT balance after swap: {}", user_b_ckusdt_balance_after);
    
    // Verify User B spent ICP
    assert!(user_b_icp_balance_after < user_b_icp_balance_initial, 
            "User B's ICP balance should have decreased after swap");
    
    // Verify User B received ckUSDT
    assert!(user_b_ckusdt_balance_after > user_b_ckusdt_balance_initial, 
            "User B's ckUSDT balance should have increased after swap");
    
    // Step 9: Check pool state after swap
    println!("STEP 9: Checking pool state after swap...");
    
    let get_pool_args = encode_one(None as Option<String>)?; // Get all pools
    let pool_result = pic_query(&ic, kong_backend, Principal::anonymous(), "pools", get_pool_args)?;
    let pool_result: PoolsResult = decode_one(&pool_result)
        .map_err(|e| anyhow::anyhow!("Failed to decode pools response: {}", e))?;
    
    let pools = match pool_result {
        PoolsResult::Ok(p) => p,
        PoolsResult::Err(e) => panic!("Pool query failed: {}", e),
    };
    
    let pool_after_swap = pools.into_iter()
        .find(|p| p.pool_id == pool_id)
        .expect("Pool not found");
    
    println!("Pool state after swap:");
    println!("Token 0 (ICP) amount: {}", pool_after_swap.token_0_amount);
    println!("Token 1 (ckUSDT) amount: {}", pool_after_swap.token_1_amount);
    
    // Verify pool balances changed correctly
    assert!(pool_after_swap.token_0_amount > initial_pool.token_0_amount, 
            "Pool ICP amount should have increased after swap");
    assert!(pool_after_swap.token_1_amount < initial_pool.token_1_amount, 
            "Pool ckUSDT amount should have decreased after swap");
    
    // Calculate and print swap amounts
    let icp_used = user_b_icp_balance_initial.clone() - user_b_icp_balance_after.clone();
    let ckusdt_received = user_b_ckusdt_balance_after.clone() - user_b_ckusdt_balance_initial.clone();
    
    println!("User B swap summary:");
    println!("ICP used: {}", icp_used);
    println!("ckUSDT received: {}", ckusdt_received);
    println!("Effective exchange rate: {} ckUSDT per ICP", 
             ckusdt_received.clone() * Nat::from(100_000_000u64) / icp_used.clone());
    
    println!("Token swap test completed successfully!");
    Ok(())
}