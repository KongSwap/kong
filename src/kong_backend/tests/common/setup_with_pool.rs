// --- Imports ---
use anyhow::{Context, Result};
use candid::{decode_one, encode_one, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

use super::identity::{get_identity_from_pem_file, get_new_identity};
use super::setup::{setup_ic_environment, CONTROLLER_PEM_FILE};

// Import kong_backend types needed for setup
use kong_backend::add_pool::add_pool_args::AddPoolArgs;
use kong_backend::add_pool::add_pool_reply::AddPoolReply;
use kong_backend::pools::pools_reply::PoolReply;
use kong_backend::stable_transfer::tx_id::TxId;

// Use the token constants from the default setup
use kong_backend::ic::ckusdt::CKUSDT_SYMBOL;
use kong_backend::ic::icp::ICP_SYMBOL;

// For test compatibility, alias the symbols
pub const TOKEN_A_SYMBOL: &str = CKUSDT_SYMBOL;
pub const TOKEN_B_SYMBOL_ICP: &str = ICP_SYMBOL;

// Keep the same fees and decimals
pub const TOKEN_A_FEE: u64 = 10_000;
pub const TOKEN_A_DECIMALS: u8 = 8;
pub const TOKEN_B_FEE_ICP: u64 = 10_000;
pub const TOKEN_B_DECIMALS_ICP: u8 = 8;


// --- Test Setup Struct ---
// Cannot derive Debug because pocket_ic::PocketIc doesn't implement Debug
pub struct SwapTestSetup {
    pub ic: pocket_ic::PocketIc,
    pub kong_backend: Principal,
    pub controller_principal: Principal,
    pub controller_account: Account,
    pub user_principal: Principal,
    pub user_account: Account,
    pub token_a_ledger_id: Principal,
    pub token_b_ledger_id: Principal,
    pub token_a_str: String,
    pub token_b_str: String,
    pub kong_account: Account,
    pub empty_account: Account,
    pub base_liquidity_a: u64,
    pub base_approve_swap_a: u64,
    pub base_transfer_swap_a: u64,
    pub base_liquidity_b: u64,
    pub base_approve_swap_b: u64,
    pub base_transfer_swap_b: u64,
    pub added_pool_reply: PoolReply,
}

// --- Main Setup Function ---
pub fn setup_swap_test_environment() -> Result<SwapTestSetup> {
    // --- Phase 1: Setup Environment, Identities, Use Pre-created Tokens ---
    let (ic, kong_backend) = setup_ic_environment()?;

    let readable_kong_backend = format!("{:?}", kong_backend);
    println!("Kong backend: {}", readable_kong_backend);

    let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE)?;
    let controller_principal = controller_identity
        .sender()
        .map_err(anyhow::Error::msg)
        .context("Failed to get controller principal")?;
    let controller_account = Account {
        owner: controller_principal,
        subaccount: None,
    };

    let user_identity = get_new_identity()?;
    let user_principal = user_identity
        .sender()
        .map_err(anyhow::Error::msg)
        .context("Failed to get user principal")?;
    let user_account = Account {
        owner: user_principal,
        subaccount: None,
    };

    // Use the pre-created tokens from initialize_default_tokens
    let token_a_ledger_id = Principal::from_text("zdzgz-siaaa-aaaar-qaiba-cai")?;
    let token_b_ledger_id = Principal::from_text("nppha-riaaa-aaaal-ajf2q-cai")?;

    let token_a_str = format!("IC.{}", token_a_ledger_id.to_text());
    let token_b_str = format!("IC.{}", token_b_ledger_id.to_text());

    // --- Phase 2: Mint Tokens to User ---
    // Define base amounts for liquidity and swaps
    let base_liquidity_a = 10_000 * 10u64.pow(TOKEN_A_DECIMALS as u32);
    let base_approve_swap_a = 5_000 * 10u64.pow(TOKEN_A_DECIMALS as u32); // For the approve/transfer_from swap test
    let base_transfer_swap_a = 3_000 * 10u64.pow(TOKEN_A_DECIMALS as u32); // For the direct transfer swap test

    let base_liquidity_b = 10_000 * 10u64.pow(TOKEN_B_DECIMALS_ICP as u32);
    let base_approve_swap_b = 2_500 * 10u64.pow(TOKEN_B_DECIMALS_ICP as u32); // Expected output from approve swap
    let base_transfer_swap_b = 1_500 * 10u64.pow(TOKEN_B_DECIMALS_ICP as u32); // Expected output from transfer swap

    // Calculate total amounts needed for all tests (accounting for fees)
    let token_a_fee_nat = Nat::from(TOKEN_A_FEE);
    let total_a_needed = Nat::from(base_liquidity_a + base_approve_swap_a + base_transfer_swap_a)
        + token_a_fee_nat.clone() * Nat::from(4u64); // 4 transfers: liquidity + approve + swap + transfer swap

    // Mint Token A to user
    let mint_a_args = TransferArg {
        from_subaccount: None,
        to: user_account,
        fee: None,
        created_at_time: None,
        memo: None,
        amount: total_a_needed.clone(),
    };
    let mint_a_payload = encode_one(&mint_a_args).expect("Failed to encode mint_a args");
    let mint_a_response = ic
        .update_call(token_a_ledger_id, controller_principal, "icrc1_transfer", mint_a_payload)
        .map_err(anyhow::Error::msg)
        .context("Failed to mint Token A")?;
    let mint_a_result = decode_one::<Result<Nat, TransferError>>(&mint_a_response).expect("Failed to decode mint_a response");
    assert!(mint_a_result.is_ok(), "Failed to mint Token A: {:?}", mint_a_result);

    let token_b_fee_nat = Nat::from(TOKEN_B_FEE_ICP);
    let total_b_needed = Nat::from(base_liquidity_b + base_transfer_swap_b) // Need enough for liquidity AND the B->A swap
        + token_b_fee_nat.clone() * Nat::from(3u64); // 3 transfers: liquidity + transfer for swap + any extra

    // Mint Token B (ICP) to user
    let mint_b_args = TransferArg {
        from_subaccount: None,
        to: user_account,
        fee: None,
        created_at_time: None,
        memo: None,
        amount: total_b_needed.clone(),
    };
    let mint_b_payload = encode_one(&mint_b_args).expect("Failed to encode mint_b args");
    let mint_b_response = ic
        .update_call(token_b_ledger_id, controller_principal, "icrc1_transfer", mint_b_payload)
        .map_err(anyhow::Error::msg)
        .context("Failed to mint Token B")?;
    let mint_b_result = decode_one::<Result<Nat, TransferError>>(&mint_b_response).expect("Failed to decode mint_b response");
    assert!(mint_b_result.is_ok(), "Failed to mint Token B: {:?}", mint_b_result);

    // --- Phase 3: Add Liquidity Pool ---
    // Transfer tokens from user to Kong for liquidity
    let liquidity_a_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: kong_backend,
            subaccount: None,
        },
        fee: Some(token_a_fee_nat.clone()),
        created_at_time: None,
        memo: None,
        amount: Nat::from(base_liquidity_a),
    };
    let liquidity_a_payload = encode_one(&liquidity_a_args).expect("Failed to encode liquidity_a args");
    let liquidity_a_response = ic
        .update_call(token_a_ledger_id, user_principal, "icrc1_transfer", liquidity_a_payload)
        .map_err(anyhow::Error::msg)
        .context("Failed to transfer Token A for liquidity")?;
    let liquidity_a_result = decode_one::<Result<Nat, TransferError>>(&liquidity_a_response).expect("Failed to decode liquidity_a response");
    let token_a_tx_id = liquidity_a_result.expect("Failed to transfer Token A for liquidity");

    let liquidity_b_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: kong_backend,
            subaccount: None,
        },
        fee: Some(token_b_fee_nat.clone()),
        created_at_time: None,
        memo: None,
        amount: Nat::from(base_liquidity_b),
    };
    let liquidity_b_payload = encode_one(&liquidity_b_args).expect("Failed to encode liquidity_b args");
    let liquidity_b_response = ic
        .update_call(token_b_ledger_id, user_principal, "icrc1_transfer", liquidity_b_payload)
        .map_err(anyhow::Error::msg)
        .context("Failed to transfer Token B for liquidity")?;
    let liquidity_b_result = decode_one::<Result<Nat, TransferError>>(&liquidity_b_response).expect("Failed to decode liquidity_b response");
    let token_b_tx_id = liquidity_b_result.expect("Failed to transfer Token B for liquidity");

    // Add the pool with the transferred liquidity
    let add_pool_args = AddPoolArgs {
        token_0: token_a_str.clone(),
        amount_0: Nat::from(base_liquidity_a),
        tx_id_0: Some(TxId::BlockIndex(token_a_tx_id)),
        token_1: token_b_str.clone(),
        amount_1: Nat::from(base_liquidity_b),
        tx_id_1: Some(TxId::BlockIndex(token_b_tx_id)),
        lp_fee_bps: Some(30),
        ..Default::default()
    };
    let add_pool_payload = encode_one(&add_pool_args).expect("Failed to encode add_pool args");
    let add_pool_response = ic
        .update_call(kong_backend, user_principal, "add_pool", add_pool_payload)
        .map_err(anyhow::Error::msg)
        .context("Failed to add pool")?;
    let add_pool_result = decode_one::<Result<AddPoolReply, String>>(&add_pool_response).expect("Failed to decode add_pool response");
    let add_pool_reply = add_pool_result.expect("Failed to add pool");

    // Assert the pool was created successfully
    assert!(add_pool_reply.amount_0 > Nat::from(0u64), "Pool amount_0 should be greater than 0");
    assert!(add_pool_reply.amount_1 > Nat::from(0u64), "Pool amount_1 should be greater than 0");
    assert!(add_pool_reply.add_lp_token_amount > Nat::from(0u64), "LP tokens should be greater than 0");

    // Convert AddPoolReply to PoolReply for test compatibility
    let added_pool_reply = PoolReply {
        pool_id: add_pool_reply.pool_id,
        name: add_pool_reply.name.clone(),
        symbol: add_pool_reply.symbol.clone(),
        chain_0: add_pool_reply.chain_0.clone(),
        symbol_0: add_pool_reply.symbol_0.clone(),
        address_0: add_pool_reply.address_0.clone(),
        balance_0: add_pool_reply.balance_0.clone(),
        lp_fee_0: Nat::from(0u64), // not provided in AddPoolReply
        chain_1: add_pool_reply.chain_1.clone(),
        symbol_1: add_pool_reply.symbol_1.clone(),
        address_1: add_pool_reply.address_1.clone(),
        balance_1: add_pool_reply.balance_1.clone(),
        lp_fee_1: Nat::from(0u64), // not provided in AddPoolReply
        price: 0.0, // not provided in AddPoolReply
        lp_fee_bps: add_pool_reply.lp_fee_bps,
        lp_token_symbol: add_pool_reply.lp_token_symbol.clone(),
        is_removed: add_pool_reply.is_removed,
    };

    // Create accounts for Kong backend and empty (for testing)
    let kong_account = Account {
        owner: kong_backend,
        subaccount: None,
    };
    let empty_account = Account {
        owner: Principal::anonymous(),
        subaccount: None,
    };

    // --- Return Setup ---
    Ok(SwapTestSetup {
        ic,
        kong_backend,
        controller_principal,
        controller_account,
        user_principal,
        user_account,
        token_a_ledger_id,
        token_b_ledger_id,
        token_a_str,
        token_b_str,
        kong_account,
        empty_account,
        base_liquidity_a,
        base_approve_swap_a,
        base_transfer_swap_a,
        base_liquidity_b,
        base_approve_swap_b,
        base_transfer_swap_b,
        added_pool_reply,
    })
}