// Test suite for add_pool functionality
// Phase 1: Setup - Create two test tokens and add them to Kong

pub mod common;

use anyhow::Result;
use candid::{decode_one, encode_one, Nat, Principal}; // Added Principal
use icrc_ledger_types::icrc1::account::Account;
use kong_backend::add_token::add_token_args::AddTokenArgs;
use kong_backend::add_token::add_token_reply::AddTokenReply;
use kong_backend::add_pool::add_pool_args::AddPoolArgs; // Added for add_pool
use kong_backend::add_pool::add_pool_reply::AddPoolReply; // Added for add_pool

// Assuming these common helpers are needed, similar to test_add_token.rs
use common::icrc1_ledger::{create_icrc1_ledger, create_icrc1_ledger_with_id, ArchiveOptions, FeatureFlags, InitArgs, LedgerArg}; // Added create_icrc1_ledger_with_id
use common::identity::{get_identity_from_pem_file, get_new_identity}; // Added get_new_identity
use common::setup::{setup_ic_environment, CONTROLLER_PEM_FILE};
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError}; // Added for minting
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError}; // Added for approval

// Constants for Test Token A
const TOKEN_A_SYMBOL: &str = "TKA";
const TOKEN_A_NAME: &str = "Test Token A";
const TOKEN_A_FEE: u64 = 10_000;
const TOKEN_A_DECIMALS: u8 = 8;

// Constants for the Mock ksUSDT Ledger (originally Token B)
// const TOKEN_B_SYMBOL: &str = "TKB"; // Unused now
// const TOKEN_B_NAME: &str = "Test Token B"; // Unused now
const TOKEN_B_FEE: u64 = 10_000; // Used for mock ksUSDT init
const TOKEN_B_DECIMALS: u8 = 8; // Used for mock ksUSDT init & liquidity amount calculation

#[test]
fn test_add_pool_setup() {
    // 1. Setup Environment
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    // Get the controller identity
    let controller_identity =
        get_identity_from_pem_file(CONTROLLER_PEM_FILE).expect("Failed to get controller identity");
    let controller_principal = controller_identity
        .sender()
        .expect("Failed to get controller principal");
    let controller_account = Account {
        owner: controller_principal,
        subaccount: None,
    };

    // Shared Archive Options
    let archive_options = ArchiveOptions {
        num_blocks_to_archive: 1000,
        max_transactions_per_response: None,
        trigger_threshold: 500,
        max_message_size_bytes: None,
        cycles_for_archive_creation: None,
        node_max_memory_size_bytes: None,
        controller_id: controller_principal,
        more_controller_ids: None,
    };

    // 2. Create Token A Ledger
    println!("Creating Token A Ledger...");
    let token_a_init_args = InitArgs {
        minting_account: controller_account,
        fee_collector_account: None,
        transfer_fee: Nat::from(TOKEN_A_FEE),
        decimals: Some(TOKEN_A_DECIMALS),
        max_memo_length: Some(32),
        token_symbol: TOKEN_A_SYMBOL.to_string(),
        token_name: TOKEN_A_NAME.to_string(),
        metadata: vec![],
        initial_balances: vec![],
        feature_flags: Some(FeatureFlags { icrc2: true }),
        archive_options: archive_options.clone(),
    };
    let token_a_ledger_id = create_icrc1_ledger(
        &ic,
        &Some(controller_principal), // Controller of the ledger
        &LedgerArg::Init(token_a_init_args),
    )
    .expect("Failed to create Token A ledger");
    println!("Token A Ledger ID: {}", token_a_ledger_id);

    // --- Create Mock ksUSDT Ledger with Specified ID ---
    // Kong Backend expects Token_1 to be ksUSDT or ICP with specific hardcoded IDs.
    // We create a mock ksUSDT ledger with the expected ID.
    println!("Creating Mock ksUSDT Ledger with specified ID...");
    // The expected ksUSDT Principal ID from the add_pool error message
    let ksusdt_principal_id = Principal::from_text("zdzgz-siaaa-aaaar-qaiba-cai").expect("Invalid ksUSDT Principal ID");

    let mock_ksusdt_init_args = InitArgs {
        minting_account: controller_account, // Use controller as minter
        fee_collector_account: None,
        transfer_fee: Nat::from(TOKEN_B_FEE), // Using TOKEN_B constants for mock ksUSDT properties
        decimals: Some(TOKEN_B_DECIMALS),     // Using TOKEN_B_DECIMALS for mock ksUSDT
        max_memo_length: Some(32),
        token_symbol: "ksUSDT".to_string(),   // Explicitly use "ksUSDT" symbol
        token_name: "Mock ksUSDT for Test".to_string(), // Clearer name for the mock
        metadata: vec![],
        initial_balances: vec![],
        feature_flags: Some(FeatureFlags { icrc2: true }),
        archive_options: archive_options.clone(),
    };
    let mock_ksusdt_ledger_id = create_icrc1_ledger_with_id(
        &ic,
        ksusdt_principal_id, // Specify the hardcoded ID
        controller_principal, // Controller of the ledger
        &LedgerArg::Init(mock_ksusdt_init_args),
    )
    .expect("Failed to create Mock ksUSDT ledger with specified ID");
    println!("Mock ksUSDT Ledger ID: {}", mock_ksusdt_ledger_id);
    // Assert that the created ID matches the specified ID
    assert_eq!(mock_ksusdt_ledger_id, ksusdt_principal_id, "Created Mock ksUSDT ID does not match specified ID");

    // 4. Add Token A to Kong Backend (using controller identity)
    println!("Adding Token A to Kong Backend...");
    let token_a_str = format!("IC.{}", token_a_ledger_id.to_text());
    let add_token_a_args = AddTokenArgs {
        token: token_a_str.clone(),
    };
    let args_a = encode_one(&add_token_a_args).expect("Failed to encode add_token_a args");

    let response_a = ic
        .update_call(kong_backend, controller_principal, "add_token", args_a)
        .expect("Failed to call add_token for Token A");

    let result_a = decode_one::<Result<AddTokenReply, String>>(&response_a)
        .expect("Failed to decode add_token response for Token A");

    assert!(
        result_a.is_ok(),
        "add_token for Token A should succeed, but got {:?}",
        result_a
    );
    println!("Token A added successfully.");

    // 5. Add Mock ksUSDT to Kong Backend (using controller identity)
    println!("Adding Mock ksUSDT to Kong Backend...");
    let mock_ksusdt_str = format!("IC.{}", mock_ksusdt_ledger_id.to_text()); // Use mock_ksusdt_ledger_id
    let add_token_mock_ksusdt_args = AddTokenArgs {
        token: mock_ksusdt_str.clone(), // Use mock_ksusdt_str
    };
    let args_mock_ksusdt = encode_one(&add_token_mock_ksusdt_args).expect("Failed to encode add_token_mock_ksusdt_args");

    let response_mock_ksusdt = ic
        .update_call(kong_backend, controller_principal, "add_token", args_mock_ksusdt)
        .expect("Failed to call add_token for Mock ksUSDT");

    let result_mock_ksusdt = decode_one::<Result<AddTokenReply, String>>(&response_mock_ksusdt)
        .expect("Failed to decode add_token response for Mock ksUSDT");

    assert!(
        result_mock_ksusdt.is_ok(),
        "add_token for Mock ksUSDT should succeed, but got {:?}",
        result_mock_ksusdt
    );
    println!("Mock ksUSDT added successfully.");

    // --- Phase 1.5: Mint tokens to a user and approve Kong ---
    println!("Setting up a test user and minting initial tokens...");

    // 6. Create a test user identity
    let user_identity = get_new_identity().expect("Failed to create new user identity");
    let user_principal = user_identity.sender().expect("Failed to get user principal");
    let user_account = Account {
        owner: user_principal,
        subaccount: None,
    };
    println!("Test User Principal: {}", user_principal);

    // Define mint and approval amounts (e.g., 10,000 of each token with 8 decimals)
    // These amounts will be used for minting to the user and then for the user to approve Kong.
    let token_a_liquidity_amount = Nat::from(10_000 * 10u64.pow(TOKEN_A_DECIMALS as u32));
    let token_b_liquidity_amount = Nat::from(10_000 * 10u64.pow(TOKEN_B_DECIMALS as u32));

    // Calculate total amount to mint for Token A (liquidity + approve_fee + transfer_from_fee)
    let total_mint_amount_a = token_a_liquidity_amount.clone() + Nat::from(TOKEN_A_FEE) + Nat::from(TOKEN_A_FEE);
    println!("Calculated total mint amount for Token A: {} (liquidity {} + approve_fee {} + transfer_from_fee {})", total_mint_amount_a, token_a_liquidity_amount, TOKEN_A_FEE, TOKEN_A_FEE);

    // 7. Mint Token A to user_account (from controller_account as minter)
    println!("Minting {} of Token A to user {}...", total_mint_amount_a, user_principal);
    let transfer_args_a = TransferArg {
        from_subaccount: None,
        to: user_account,
        amount: total_mint_amount_a.clone(), // Mint total amount needed
        fee: None, // Ledger uses its default fee
        memo: None,
        created_at_time: None, // Ledger sets current time
    };
    let transfer_payload_a = encode_one(transfer_args_a).expect("Failed to encode transfer_args_a for Token A");
    let transfer_response_a = ic
        .update_call(token_a_ledger_id, controller_principal, "icrc1_transfer", transfer_payload_a)
        .expect("Failed to call icrc1_transfer for Token A");
    let transfer_result_a = decode_one::<Result<Nat, TransferError>>(&transfer_response_a)
        .expect("Failed to decode icrc1_transfer response for Token A");
    assert!(
        transfer_result_a.is_ok(),
        "Minting Token A to user failed: {:?}",
        transfer_result_a
    );
    println!("Token A minted to user {} successfully.", user_principal);

    // Calculate total amount to mint for Token B (liquidity + approve_fee + transfer_from_fee)
    let total_mint_amount_b = token_b_liquidity_amount.clone() + Nat::from(TOKEN_B_FEE) + Nat::from(TOKEN_B_FEE);
    println!("Calculated total mint amount for Token B: {} (liquidity {} + approve_fee {} + transfer_from_fee {})", total_mint_amount_b, token_b_liquidity_amount, TOKEN_B_FEE, TOKEN_B_FEE);

    // 8. Mint Token B to user_account
    println!("Minting {} of Token B to user {}...", total_mint_amount_b, user_principal);
    let transfer_args_b = TransferArg {
        from_subaccount: None,
        to: user_account,
        amount: total_mint_amount_b.clone(), // Mint total amount needed
        fee: None,
        memo: None,
        created_at_time: None,
    };
    let transfer_payload_b = encode_one(transfer_args_b).expect("Failed to encode transfer_args_b for Token B");
    let transfer_response_b = ic
        .update_call(mock_ksusdt_ledger_id, controller_principal, "icrc1_transfer", transfer_payload_b) // Use mock_ksusdt_ledger_id
        .expect("Failed to call icrc1_transfer for Token B");
    let transfer_result_b = decode_one::<Result<Nat, TransferError>>(&transfer_response_b)
        .expect("Failed to decode icrc1_transfer response for Token B");
    assert!(
        transfer_result_b.is_ok(),
        "Minting Token B to user failed: {:?}",
        transfer_result_b
    );
    println!("Token B minted to user {} successfully.", user_principal);

    // 9. User approves Kong Backend for Token A
    println!("User {} approving Kong Backend for {} of Token A...", user_principal, token_a_liquidity_amount);
    // Calculate approval amount including fee for Token A
    let approve_amount_a = token_a_liquidity_amount.clone() + Nat::from(TOKEN_A_FEE);
    println!("User {} approving Kong Backend for {} of Token A ({} + {} fee)...", user_principal, approve_amount_a, token_a_liquidity_amount, TOKEN_A_FEE);
    let approve_args_a = ApproveArgs {
        from_subaccount: None,
        spender: Account { owner: kong_backend, subaccount: None }, // kong_backend is the Principal
        amount: approve_amount_a, // Approve amount + fee
        expected_allowance: None,
        expires_at: None, // No expiry for simplicity
        fee: None,
        memo: None,
        created_at_time: None,
    };
    let approve_payload_a = encode_one(approve_args_a).expect("Failed to encode approve_args_a for Token A");
    let approve_response_a = ic
        .update_call(token_a_ledger_id, user_principal, "icrc2_approve", approve_payload_a)
        .expect("Failed to call icrc2_approve for Token A by user");
    let approve_result_a = decode_one::<Result<Nat, ApproveError>>(&approve_response_a)
        .expect("Failed to decode icrc2_approve response for Token A");
    assert!(
        approve_result_a.is_ok(),
        "User approval for Token A failed: {:?}",
        approve_result_a
    );
    println!("Token A approved for Kong Backend by user {}.", user_principal);

    // 10. User approves Kong Backend for Token B (Mock ksUSDT)
    // Calculate approval amount including fee for Token B
    let approve_amount_b = token_b_liquidity_amount.clone() + Nat::from(TOKEN_B_FEE);
    println!("User {} approving Kong Backend for {} of Token B ({} + {} fee)...", user_principal, approve_amount_b, token_b_liquidity_amount, TOKEN_B_FEE);
    let approve_args_b = ApproveArgs {
        from_subaccount: None,
        spender: Account { owner: kong_backend, subaccount: None },
        amount: approve_amount_b, // Approve amount + fee
        expected_allowance: None,
        expires_at: None,
        fee: None,
        memo: None,
        created_at_time: None,
    };
    let approve_payload_b = encode_one(approve_args_b).expect("Failed to encode approve_args_b for Token B");
    let approve_response_b = ic
        .update_call(mock_ksusdt_ledger_id, user_principal, "icrc2_approve", approve_payload_b) // Use mock_ksusdt_ledger_id
        .expect("Failed to call icrc2_approve for Token B by user");
    let approve_result_b = decode_one::<Result<Nat, ApproveError>>(&approve_response_b)
        .expect("Failed to decode icrc2_approve response for Token B");
    assert!(
        approve_result_b.is_ok(),
        "User approval for Token B failed: {:?}",
        approve_result_b
    );
    println!("Token B approved for Kong Backend by user {}.", user_principal);

    println!("Minting and approval steps are now complete for user {}.", user_principal);

    // --- Phase 2: Call add_pool ---
    println!("User {} attempting to add a new pool with Token A ({}) and Mock ksUSDT ({})", user_principal, token_a_str, mock_ksusdt_str); // Use mock_ksusdt_str in log

    // 11. Construct AddPoolArgs
    // Amounts are the ones minted to the user and approved for Kong Backend
    let add_pool_args = AddPoolArgs {
        token_0: token_a_str.clone(), // token_a_str was defined earlier
        amount_0: token_a_liquidity_amount.clone(),
        tx_id_0: None, // We are using the approve/transfer_from flow, not pre-transfer verification
        token_1: mock_ksusdt_str.clone(), // Use mock_ksusdt_str
        amount_1: token_b_liquidity_amount.clone(),
        tx_id_1: None,
        lp_fee_bps: None, // Use default LP fee configured in the canister
    };

    // 12. Encode args and call add_pool as the user
    let add_pool_payload = encode_one(&add_pool_args).expect("Failed to encode add_pool_args");
    
    println!("Calling add_pool on canister {} as user {} with payload: {:?}", kong_backend, user_principal, add_pool_args);

    let add_pool_response_bytes = ic
        .update_call(kong_backend, user_principal, "add_pool", add_pool_payload)
        .expect("Failed to call add_pool");

    // 13. Decode reply and assert success
    let add_pool_result = decode_one::<Result<AddPoolReply, String>>(&add_pool_response_bytes)
        .expect("Failed to decode add_pool response");
    
    assert!(
        add_pool_result.is_ok(),
        "add_pool call failed: {:?}",
        add_pool_result
    );
    println!("add_pool call successful. Reply: {:?}", add_pool_result.as_ref().unwrap());

    // TODO: Further verification:
    // 1. Define AddPoolReply struct and inspect its contents (e.g., pool_id, lp_token_id).
    // 2. Query kong_backend for the list of pools and verify the new pool exists with correct details.
    // 3. Query user's balance of the new LP token on its ledger.
}

// TODO: Add tests for add_pool logic itself (approvals, amounts, pool creation, state verification)
