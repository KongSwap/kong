// src/kong_backend/tests/test_swap.rs
pub mod common;

use anyhow::Result;
use candid::{decode_one, encode_one, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};

use common::icrc1_ledger::{create_icrc1_ledger, create_icrc1_ledger_with_id, ArchiveOptions, FeatureFlags, InitArgs, LedgerArg};
use common::identity::{get_identity_from_pem_file, get_new_identity};
use common::setup::{setup_ic_environment, CONTROLLER_PEM_FILE};

// Import kong_backend types
use kong_backend::add_pool::add_pool_args::AddPoolArgs;
use kong_backend::add_pool::add_pool_reply::AddPoolReply;
use kong_backend::add_token::add_token_args::AddTokenArgs;
use kong_backend::add_token::add_token_reply::AddTokenReply;
// Import the CORRECT swap types
use kong_backend::stable_transfer::tx_id::TxId;
use kong_backend::swap::swap_args::SwapArgs;
use kong_backend::swap::swap_reply::SwapReply; // ADDED use statement

// --- Constants ---
const TOKEN_A_SYMBOL: &str = "SWPA"; // Swap Test Token A
const TOKEN_A_NAME: &str = "Swap Test Token A";
const TOKEN_A_FEE: u64 = 10_000;
const TOKEN_A_DECIMALS: u8 = 8;

const TOKEN_B_SYMBOL_ICP: &str = "ICP"; // Mock ICP
const TOKEN_B_NAME_ICP: &str = "Internet Computer Protocol (Swap Test)";
const TOKEN_B_FEE_ICP: u64 = 10_000;
const TOKEN_B_DECIMALS_ICP: u8 = 8;

fn get_icrc1_balance(ic: &pocket_ic::PocketIc, ledger_id: Principal, account: Account) -> Nat {
    let payload = encode_one(account).expect("Failed to encode account for balance_of");
    let response = ic
        .query_call(ledger_id, Principal::anonymous(), "icrc1_balance_of", payload)
        .expect("Failed to call icrc1_balance_of");
    decode_one::<Nat>(&response).expect("Failed to decode icrc1_balance_of response")
}

// --- Test Function ---
#[test]
fn test_swap_a_to_b_happy_path() {
    // --- Phase 1: Setup Environment, Identities, Ledgers ---
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    let readable_kong_backend = format!("{:?}", kong_backend);
    println!("Kong backend: {}", readable_kong_backend);

    let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE).expect("Failed to get controller identity");
    let controller_principal = controller_identity.sender().expect("Failed to get controller principal");
    let controller_account = Account {
        owner: controller_principal,
        subaccount: None,
    };

    let user_identity = get_new_identity().expect("Failed to create new user identity");
    let user_principal = user_identity.sender().expect("Failed to get user principal");
    let user_account = Account {
        owner: user_principal,
        subaccount: None,
    };

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

    // Create Token A Ledger
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
    let token_a_ledger_id = create_icrc1_ledger(&ic, &Some(controller_principal), &LedgerArg::Init(token_a_init_args))
        .expect("Failed to create Token A ledger");

    // Create Token B (Mock ICP) Ledger
    let token_b_principal_id = Principal::from_text("nppha-riaaa-aaaal-ajf2q-cai").expect("Invalid Testnet ICP Principal ID"); // Use Testnet ICP ID
    let token_b_init_args = InitArgs {
        minting_account: controller_account,
        fee_collector_account: None,
        transfer_fee: Nat::from(TOKEN_B_FEE_ICP),
        decimals: Some(TOKEN_B_DECIMALS_ICP),
        max_memo_length: Some(32),
        token_symbol: TOKEN_B_SYMBOL_ICP.to_string(),
        token_name: TOKEN_B_NAME_ICP.to_string(),
        metadata: vec![],
        initial_balances: vec![],
        feature_flags: Some(FeatureFlags { icrc2: true }),
        archive_options: archive_options.clone(),
    };
    let token_b_ledger_id = create_icrc1_ledger_with_id(
        &ic,
        token_b_principal_id,
        controller_principal,
        &LedgerArg::Init(token_b_init_args.clone()),
    )
    .expect("Failed to create ICP ledger for Token B");
    assert_eq!(
        token_b_ledger_id, token_b_principal_id,
        "Created ICP Ledger ID does not match specified ID"
    );

    // --- Phase 2: Add Tokens to Kong ---
    let token_a_str = format!("IC.{}", token_a_ledger_id.to_text());
    let add_token_a_args = AddTokenArgs {
        token: token_a_str.clone(),
    };
    let args_a = encode_one(&add_token_a_args).expect("Failed to encode add_token_a args");
    let response_a = ic
        .update_call(kong_backend, controller_principal, "add_token", args_a)
        .expect("Failed to call add_token for Token A");
    let result_a = decode_one::<Result<AddTokenReply, String>>(&response_a).expect("Failed to decode add_token response for Token A");
    assert!(result_a.is_ok(), "add_token for Token A failed: {:?}", result_a);

    let token_b_str = format!("IC.{}", token_b_ledger_id.to_text());
    let add_token_b_args = AddTokenArgs {
        token: token_b_str.clone(),
    };
    let args_token_b = encode_one(&add_token_b_args).expect("Failed to encode add_token_b_args");
    let response_token_b = ic
        .update_call(kong_backend, controller_principal, "add_token", args_token_b)
        .expect("Failed to call add_token for Token B (ICP)");
    let result_token_b =
        decode_one::<Result<AddTokenReply, String>>(&response_token_b).expect("Failed to decode add_token response for Token B (ICP)");
    assert!(result_token_b.is_ok(), "add_token for Token B (ICP) failed: {:?}", result_token_b);

    // --- Phase 3: Mint Tokens to User ---
    // Define base amounts for liquidity and swaps
    let base_liquidity_a = 10_000 * 10u64.pow(TOKEN_A_DECIMALS as u32);
    let base_approve_swap_a = 5_000 * 10u64.pow(TOKEN_A_DECIMALS as u32); // For the approve/transfer_from swap test
    let base_direct_swap_a = 4_000 * 10u64.pow(TOKEN_A_DECIMALS as u32); // For the direct transfer swap A->B test

    let base_liquidity_b = 10_000 * 10u64.pow(TOKEN_B_DECIMALS_ICP as u32);
    let base_direct_swap_b = 3_000 * 10u64.pow(TOKEN_B_DECIMALS_ICP as u32); // For the direct transfer swap B->A test

    // Calculate total fees needed for Token A
    // 1. Add Pool (direct transfer)
    // 2. Approve (for approve/transfer_from swap)
    // 3. Transfer From (part of approve/transfer_from swap)
    // 4. Direct Transfer (for direct transfer swap A->B)
    let total_fees_a = Nat::from(TOKEN_A_FEE * 4);

    // Calculate total fees needed for Token B
    // 1. Add Pool (direct transfer)
    // 2. Direct Transfer (for direct transfer swap B->A)
    let total_fees_b = Nat::from(TOKEN_B_FEE_ICP * 2);

    // Calculate total mint amounts
    let total_mint_amount_a = Nat::from(base_liquidity_a + base_approve_swap_a + base_direct_swap_a) + total_fees_a.clone();
    let total_mint_amount_b = Nat::from(base_liquidity_b + base_direct_swap_b) + total_fees_b.clone();

    println!("\n--- Minting Tokens ---");
    println!("  Minting {} of Token A ({}) to User", total_mint_amount_a, TOKEN_A_SYMBOL);
    println!("  Minting {} of Token B ({}) to User", total_mint_amount_b, TOKEN_B_SYMBOL_ICP);

    // Mint Token A
    let transfer_args_a = TransferArg {
        from_subaccount: None,
        to: user_account,
        amount: total_mint_amount_a.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };
    let transfer_payload_a = encode_one(transfer_args_a).expect("Failed to encode transfer_args_a for Token A");
    let transfer_response_a = ic
        .update_call(token_a_ledger_id, controller_principal, "icrc1_transfer", transfer_payload_a)
        .expect("Failed to call icrc1_transfer for Token A");
    let transfer_result_a =
        decode_one::<Result<Nat, TransferError>>(&transfer_response_a).expect("Failed to decode icrc1_transfer response for Token A");
    assert!(transfer_result_a.is_ok(), "Minting Token A failed: {:?}", transfer_result_a);
    let user_balance_a_after_mint = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    assert_eq!(user_balance_a_after_mint, total_mint_amount_a, "User balance A after mint");

    // Mint Token B
    let transfer_args_b = TransferArg {
        from_subaccount: None,
        to: user_account,
        amount: total_mint_amount_b.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };
    let transfer_payload_b = encode_one(transfer_args_b).expect("Failed to encode transfer_args_b for Token B");
    let transfer_response_b = ic
        .update_call(token_b_ledger_id, controller_principal, "icrc1_transfer", transfer_payload_b)
        .expect("Failed to call icrc1_transfer for Token B");
    let transfer_result_b =
        decode_one::<Result<Nat, TransferError>>(&transfer_response_b).expect("Failed to decode icrc1_transfer response for Token B");
    assert!(transfer_result_b.is_ok(), "Minting Token B failed: {:?}", transfer_result_b);
    let user_balance_b_after_mint = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    assert_eq!(user_balance_b_after_mint, total_mint_amount_b, "User balance B after mint");

    // --- Phase 4: Transfer Liquidity and Add Pool ---
    let kong_account = Account {
        owner: kong_backend,
        subaccount: None,
    };

    println!("Kong account: {:?}", kong_account);

    // Define liquidity amounts based on base values
    let liquidity_amount_a = Nat::from(base_liquidity_a);
    let liquidity_amount_b = Nat::from(base_liquidity_b);

    // User transfers Token A directly to Kong
    println!("\n--- User transferring Token A liquidity to Kong ---");
    let transfer_liq_a_args = TransferArg {
        from_subaccount: None,
        to: kong_account, // Send TO Kong
        amount: liquidity_amount_a.clone(),
        fee: None, // Use default fee
        memo: None,
        created_at_time: None,
    };
    let transfer_liq_a_payload = encode_one(transfer_liq_a_args).expect("Failed to encode transfer_liq_a_args");
    let transfer_liq_a_response = ic
        .update_call(token_a_ledger_id, user_principal, "icrc1_transfer", transfer_liq_a_payload) // Called by USER
        .expect("Failed to call icrc1_transfer for Token A liquidity");
    let transfer_liq_a_result = decode_one::<Result<Nat, TransferError>>(&transfer_liq_a_response)
        .expect("Failed to decode icrc1_transfer response for Token A liquidity");
    assert!(
        transfer_liq_a_result.is_ok(),
        "User transfer Token A liquidity failed: {:?}",
        transfer_liq_a_result
    );
    let tx_id_a = transfer_liq_a_result.unwrap(); // Capture the block index (tx_id)
    println!("  Token A liquidity transfer successful, Tx ID: {}", tx_id_a);

    // User transfers Token B directly to Kong
    println!("\n--- User transferring Token B liquidity to Kong ---");
    let transfer_liq_b_args = TransferArg {
        from_subaccount: None,
        to: kong_account, // Send TO Kong
        amount: liquidity_amount_b.clone(),
        fee: None, // Use default fee
        memo: None,
        created_at_time: None,
    };
    let transfer_liq_b_payload = encode_one(transfer_liq_b_args).expect("Failed to encode transfer_liq_b_args");
    let transfer_liq_b_response = ic
        .update_call(token_b_ledger_id, user_principal, "icrc1_transfer", transfer_liq_b_payload) // Called by USER
        .expect("Failed to call icrc1_transfer for Token B liquidity");
    let transfer_liq_b_result = decode_one::<Result<Nat, TransferError>>(&transfer_liq_b_response)
        .expect("Failed to decode icrc1_transfer response for Token B liquidity");
    assert!(
        transfer_liq_b_result.is_ok(),
        "User transfer Token B liquidity failed: {:?}",
        transfer_liq_b_result
    );
    let tx_id_b = transfer_liq_b_result.unwrap(); // Capture the block index (tx_id)
    println!("  Token B liquidity transfer successful, Tx ID: {}", tx_id_b);

    // Check user balances after direct transfers
    let user_balance_a_after_liq_transfer = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_after_liq_transfer = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    // Expected: Minted Balance - Transfer Amount - Transfer Fee
    let expected_user_a_after_liq_transfer = total_mint_amount_a.clone() - liquidity_amount_a.clone() - Nat::from(TOKEN_A_FEE); // Fee for transfer
    let expected_user_b_after_liq_transfer = total_mint_amount_b.clone() - liquidity_amount_b.clone() - Nat::from(TOKEN_B_FEE_ICP); // Fee for transfer
    assert_eq!(
        user_balance_a_after_liq_transfer, expected_user_a_after_liq_transfer,
        "User balance A after liq transfer"
    );
    assert_eq!(
        user_balance_b_after_liq_transfer, expected_user_b_after_liq_transfer,
        "User balance B after liq transfer"
    );

    // Add Pool - Now providing the tx_ids for verification
    println!("\n--- Calling add_pool with transfer verification ---");
    let add_pool_args = AddPoolArgs {
        token_0: token_a_str.clone(),
        amount_0: liquidity_amount_a.clone(),
        tx_id_0: Some(TxId::BlockIndex(tx_id_a)), // Use imported TxId
        token_1: token_b_str.clone(),
        amount_1: liquidity_amount_b.clone(),
        tx_id_1: Some(TxId::BlockIndex(tx_id_b)), // Use imported TxId
        lp_fee_bps: None,                         // Use default fee
    };
    let add_pool_payload = encode_one(&add_pool_args).expect("Failed to encode add_pool_args");
    let add_pool_response_bytes = ic
        .update_call(kong_backend, user_principal, "add_pool", add_pool_payload)
        .expect("Failed to call add_pool");
    let add_pool_result = decode_one::<Result<AddPoolReply, String>>(&add_pool_response_bytes).expect("Failed to decode add_pool response");
    assert!(add_pool_result.is_ok(), "add_pool call failed: {:?}", add_pool_result);

    // --- Query pool state after adding liquidity ---
    let pools_query_payload = encode_one(None::<Option<String>>).expect("Failed to encode pools query payload");
    let pools_response_bytes = ic
        .query_call(
            kong_backend,
            Principal::anonymous(), // Caller doesn't matter for query
            "pools",
            pools_query_payload,
        )
        .expect("Failed to call 'pools' query");
    let pools_result = decode_one::<Result<Vec<kong_backend::pools::pools_reply::PoolReply>, String>>(&pools_response_bytes)
        .expect("Failed to decode 'pools' response");
    assert!(pools_result.is_ok(), "Querying pools failed: {:?}", pools_result);

    // Check balances after adding liquidity (User AND Kong)
    println!("\n--- Balances AFTER Add Pool ---"); // ADDED Header
    let user_balance_a_after_add_pool = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_after_add_pool = get_icrc1_balance(&ic, token_b_ledger_id, user_account); // Moved up
    let kong_balance_a_after_add_pool = get_icrc1_balance(&ic, token_a_ledger_id, kong_account); // ADDED
    let kong_balance_b_after_add_pool = get_icrc1_balance(&ic, token_b_ledger_id, kong_account); // ADDED

    println!(
        "  User Balance A ({}): {}", // ADDED Print
        TOKEN_A_SYMBOL, user_balance_a_after_add_pool
    );
    println!(
        "  User Balance B ({}): {}", // ADDED Print
        TOKEN_B_SYMBOL_ICP, user_balance_b_after_add_pool
    );
    println!(
        "  Kong Balance A ({}): {}", // ADDED Print
        TOKEN_A_SYMBOL, kong_balance_a_after_add_pool
    );
    println!(
        "  Kong Balance B ({}): {}", // ADDED Print
        TOKEN_B_SYMBOL_ICP, kong_balance_b_after_add_pool
    );

    // Check User balances after adding liquidity (should be unchanged from after direct transfers)
    assert_eq!(
        user_balance_a_after_add_pool, expected_user_a_after_liq_transfer,
        "User balance A after add_pool (verify flow)"
    );
    assert_eq!(
        user_balance_b_after_add_pool, expected_user_b_after_liq_transfer,
        "User balance B after add_pool (verify flow)"
    );

    // Check Kong balances after adding liquidity
    // Expected: Initial (0) + LiqAmount
    assert_eq!(
        kong_balance_a_after_add_pool,
        liquidity_amount_a, // ADDED Check
        "Kong balance A after add_pool"
    );
    assert_eq!(
        kong_balance_b_after_add_pool,
        liquidity_amount_b, // ADDED Check
        "Kong balance B after add_pool"
    );

    // --- Phase 5: Approve and Swap (A -> B using icrc2_approve/transfer_from) ---
    println!("\n--- Phase 5: Approve and Swap (A -> B using icrc2_approve/transfer_from) ---");
    let approve_swap_amount_a = Nat::from(base_approve_swap_a); // Use the specific amount for this swap type
    let amount_out_min_b_approve_swap = Nat::from(1u64); // Expect at least 1 tiny unit of B out

    // NOTE: Swap still uses approve/transfer_from flow in this test.
    // This is separate from how liquidity was added.

    // Approve Token A for Swap
    println!("\n--- Approving Token A for Approve/TransferFrom Swap ---");
    let approve_total_amount_a = approve_swap_amount_a.clone() + Nat::from(TOKEN_A_FEE); // Amount + fee for subsequent transfer_from
    let approve_args_swap_a = ApproveArgs {
        from_subaccount: None,
        spender: kong_account,                  // Approve Kong backend to spend
        amount: approve_total_amount_a.clone(), // Approve enough for the swap amount + transfer_from fee
        expected_allowance: None,
        expires_at: None,
        fee: None, // Use default fee (user pays this approve fee now)
        memo: None,
        created_at_time: None,
    };
    let approve_payload_swap_a = encode_one(approve_args_swap_a).expect("Failed to encode approve_args_swap_a");
    let approve_response_swap_a = ic
        .update_call(token_a_ledger_id, user_principal, "icrc2_approve", approve_payload_swap_a) // Called by USER
        .expect("Failed to call icrc2_approve for Token A swap");
    let approve_result_swap_a = decode_one::<Result<Nat, ApproveError>>(&approve_response_swap_a)
        .expect("Failed to decode icrc2_approve response for Token A swap");
    assert!(
        approve_result_swap_a.is_ok(),
        "Approve Token A swap failed: {:?}",
        approve_result_swap_a
    );
    println!("  Token A approved for swap successfully.");

    // Get balances *before* the swap (User and Kong)
    // Re-fetch kong_account just in case, though it's the same principal
    let kong_account = Account {
        owner: kong_backend,
        subaccount: None,
    };
    println!(
        "DEBUG TEST: kong_backend principal used for its balance check: {}",
        kong_backend.to_text()
    ); // Print Kong's Principal
    let kong_balance_a_before_swap = get_icrc1_balance(&ic, token_a_ledger_id, kong_account); // ADDED
    let kong_balance_b_before_swap = get_icrc1_balance(&ic, token_b_ledger_id, kong_account); // RENAMED for consistency
    println!("--- Balances BEFORE Swap ---"); // ADDED Header
    println!(
        "  Kong Balance A ({}): {}", // ADDED
        TOKEN_A_SYMBOL, kong_balance_a_before_swap
    );
    println!(
        "  Kong Balance B ({}): {}", // MODIFIED Print
        TOKEN_B_SYMBOL_ICP, kong_balance_b_before_swap
    );
    let user_balance_a_before_swap = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_before_swap = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    println!(
        "  User Balance A ({}): {}", // ADDED Print
        TOKEN_A_SYMBOL, user_balance_a_before_swap
    );
    println!(
        "  User Balance B ({}): {}", // ADDED Print
        TOKEN_B_SYMBOL_ICP, user_balance_b_before_swap
    );
    // Expected A: Balance after Liq Transfer - Swap Approve Fee
    let expected_a_before_swap = user_balance_a_after_add_pool.clone() - Nat::from(TOKEN_A_FEE);
    assert_eq!(user_balance_a_before_swap, expected_a_before_swap, "User balance A before swap ");
    // Expected B: Balance after Liq Transfer (no change from swap approve)
    assert_eq!(
        user_balance_b_before_swap, user_balance_b_after_add_pool,
        "User balance B before approve/transfer_from swap "
    );

    // Perform the Swap (Token A -> Token B using transfer_from)
    println!("\n--- Calling swap (Approve/TransferFrom Flow) ---");
    // Use the correct SwapArgs struct
    let swap_args_approve = SwapArgs {
        pay_token: token_a_str.clone(),
        pay_amount: approve_swap_amount_a.clone(), // The actual amount to swap
        pay_tx_id: None,                           // Swap uses transfer_from, so no tx_id needed here
        receive_token: token_b_str.clone(),
        receive_amount: Some(amount_out_min_b_approve_swap.clone()), // Minimum expected
        receive_address: Some(user_principal.to_text()),             // Explicitly set receive address
        max_slippage: Some(50.0),                                    // Explicitly allow up to 50% slippage for this test
        referred_by: None,
    };
    let swap_payload_approve = encode_one(&swap_args_approve).expect("Failed to encode swap_args_approve ");

    let swap_response_bytes_approve = ic
        .update_call(kong_backend, user_principal, "swap", swap_payload_approve)
        .expect("Failed to call swap (approve flow)");

    // Decode swap response using the correct SwapReply struct
    let swap_result_approve = decode_one::<Result<SwapReply, String>>(&swap_response_bytes_approve)
        .expect("Failed to decode swap_transfer response (approve flow)");

    println!("Swap result (approve flow): {:?}", swap_result_approve); // Debug print

    assert!(
        swap_result_approve.is_ok(),
        "swap_transfer call failed (approve flow): {:?}",
        swap_result_approve
    );
    let swap_reply_approve = swap_result_approve.unwrap(); // Unwrap the Ok result
    let amount_out_b_actual_approve = swap_reply_approve.receive_amount; // Get actual amount from reply

    // Check if actual amount meets minimum requirement
    assert!(
        amount_out_b_actual_approve >= amount_out_min_b_approve_swap,
        "Actual amount out ({}) is less than minimum expected ({}) in approve swap",
        amount_out_b_actual_approve,
        amount_out_min_b_approve_swap
    );

    // --- Phase 6: Verify Balances After Approve/TransferFrom Swap ---
    println!("\n--- Balances AFTER Approve/TransferFrom Swap ---");
    let user_balance_a_after_approve_swap = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_after_approve_swap = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let kong_balance_a_after_approve_swap = get_icrc1_balance(&ic, token_a_ledger_id, kong_account); // Check Kong
    let kong_balance_b_after_approve_swap = get_icrc1_balance(&ic, token_b_ledger_id, kong_account); // Check Kong

    // Expected User A: BalanceBeforeSwap - SwapAmountIn - SwapTransferFromFee
    let expected_user_a_after_approve_swap = user_balance_a_before_swap.clone() - approve_swap_amount_a.clone() - Nat::from(TOKEN_A_FEE);
    assert_eq!(
        user_balance_a_after_approve_swap, expected_user_a_after_approve_swap,
        "User balance A after approve/transfer_from swap"
    );

    // Expected User B: BalanceBeforeSwap + AmountReceivedB (Kong pays transfer fee from its account)
    let expected_user_b_after_approve_swap = user_balance_b_before_swap.clone() + amount_out_b_actual_approve.clone();
    assert_eq!(
        user_balance_b_after_approve_swap, expected_user_b_after_approve_swap,
        "User balance B after approve/transfer_from swap. Expected {}, got {}",
        expected_user_b_after_approve_swap, user_balance_b_after_approve_swap
    );

    // Expected Kong A: BalanceBeforeSwap + SwapAmountIn
    let expected_kong_a_after_approve_swap = kong_balance_a_before_swap.clone() + approve_swap_amount_a.clone();
    assert_eq!(
        kong_balance_a_after_approve_swap, expected_kong_a_after_approve_swap,
        "Kong balance A after approve/transfer_from swap"
    );
    // Expected Kong B: BalanceBeforeSwap - AmountReceivedB - TransferFeeB
    let expected_kong_b_after_approve_swap =
        kong_balance_b_before_swap.clone() - amount_out_b_actual_approve.clone() - Nat::from(TOKEN_B_FEE_ICP);
    assert_eq!(
        kong_balance_b_after_approve_swap, expected_kong_b_after_approve_swap,
        "Kong balance B after approve/transfer_from swap"
    );

    println!("  User Balance A ({}): {}", TOKEN_A_SYMBOL, user_balance_a_after_approve_swap);
    println!("  User Balance B ({}): {}", TOKEN_B_SYMBOL_ICP, user_balance_b_after_approve_swap);
    println!("  Kong Balance A ({}): {}", TOKEN_A_SYMBOL, kong_balance_a_after_approve_swap);
    println!("  Kong Balance B ({}): {}", TOKEN_B_SYMBOL_ICP, kong_balance_b_after_approve_swap);

    // --- Phase 7: Swap A -> B with Direct Transfer ---
    println!("\n--- Phase 7: Swap A -> B with Direct Transfer ---");
    let direct_swap_amount_a = Nat::from(base_direct_swap_a);
    let amount_out_min_b_direct_swap = Nat::from(1u64);

    // Get balances before direct transfer swap
    let user_balance_a_before_direct_swap = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_before_direct_swap = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let kong_balance_a_before_direct_swap = get_icrc1_balance(&ic, token_a_ledger_id, kong_account);
    let kong_balance_b_before_direct_swap = get_icrc1_balance(&ic, token_b_ledger_id, kong_account);
    println!("--- Balances BEFORE Direct Transfer Swap (A -> B) ---");
    println!(
        "  User Balance A: {}, User Balance B: {}",
        user_balance_a_before_direct_swap, user_balance_b_before_direct_swap
    );
    println!(
        "  Kong Balance A: {}, Kong Balance B: {}",
        kong_balance_a_before_direct_swap, kong_balance_b_before_direct_swap
    );

    // User transfers Token A directly to Kong for the swap
    println!("\n--- User transferring Token A directly to Kong for swap ---");
    let transfer_direct_swap_a_args = TransferArg {
        from_subaccount: None,
        to: kong_account, // Send TO Kong
        amount: direct_swap_amount_a.clone(),
        fee: None, // Use default fee
        memo: None,
        created_at_time: None,
    };
    let transfer_direct_swap_a_payload = encode_one(transfer_direct_swap_a_args).expect("Failed to encode transfer_direct_swap_a_args");
    let transfer_direct_swap_a_response = ic
        .update_call(token_a_ledger_id, user_principal, "icrc1_transfer", transfer_direct_swap_a_payload) // Called by USER
        .expect("Failed to call icrc1_transfer for Token A direct swap");
    let transfer_direct_swap_a_result = decode_one::<Result<Nat, TransferError>>(&transfer_direct_swap_a_response)
        .expect("Failed to decode icrc1_transfer response for Token A direct swap");
    assert!(
        transfer_direct_swap_a_result.is_ok(),
        "User transfer Token A for direct swap failed: {:?}",
        transfer_direct_swap_a_result
    );
    let tx_id_direct_swap_a = transfer_direct_swap_a_result.unwrap(); // Capture the block index (tx_id)
    println!("  Token A direct transfer for swap successful, Tx ID: {}", tx_id_direct_swap_a);

    // Check user balance A immediately after transfer (before swap call)
    let user_balance_a_after_direct_transfer = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let expected_user_a_after_direct_transfer =
        user_balance_a_before_direct_swap.clone() - direct_swap_amount_a.clone() - Nat::from(TOKEN_A_FEE);
    assert_eq!(
        user_balance_a_after_direct_transfer, expected_user_a_after_direct_transfer,
        "User balance A after direct transfer, before swap call"
    );

    // Perform the Swap (Token A -> Token B using direct transfer tx_id)
    println!("\n--- Calling swap (Direct Transfer Flow A -> B) ---");
    let swap_args_direct_a = SwapArgs {
        pay_token: token_a_str.clone(),
        pay_amount: direct_swap_amount_a.clone(),
        pay_tx_id: Some(TxId::BlockIndex(tx_id_direct_swap_a)), // Provide the tx_id
        receive_token: token_b_str.clone(),
        receive_amount: Some(amount_out_min_b_direct_swap.clone()), // Minimum expected
        receive_address: Some(user_principal.to_text()),            // Explicitly set receive address
        max_slippage: Some(50.0),                                   // Explicitly allow up to 50% slippage
        referred_by: None,
    };
    let swap_payload_direct_a = encode_one(&swap_args_direct_a).expect("Failed to encode swap_args_direct_a ");

    let swap_response_bytes_direct_a = ic
        .update_call(kong_backend, user_principal, "swap", swap_payload_direct_a)
        .expect("Failed to call swap (direct flow A->B)");

    let swap_result_direct_a = decode_one::<Result<SwapReply, String>>(&swap_response_bytes_direct_a)
        .expect("Failed to decode swap_transfer response (direct flow A->B)");

    println!("Swap result (direct flow A->B): {:?}", swap_result_direct_a);
    assert!(
        swap_result_direct_a.is_ok(),
        "swap_transfer call failed (direct flow A->B): {:?}",
        swap_result_direct_a
    );
    let swap_reply_direct_a = swap_result_direct_a.unwrap();
    let amount_out_b_actual_direct = swap_reply_direct_a.receive_amount;

    // Check minimum amount requirement
    assert!(
        amount_out_b_actual_direct >= amount_out_min_b_direct_swap,
        "Actual amount out ({}) is less than minimum expected ({}) in direct swap A->B",
        amount_out_b_actual_direct,
        amount_out_min_b_direct_swap
    );

    // Verify Balances After Direct Transfer Swap (A -> B)
    println!("\n--- Balances AFTER Direct Transfer Swap (A -> B) ---");
    let user_balance_a_after_direct_swap_a = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_after_direct_swap_a = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let kong_balance_a_after_direct_swap_a = get_icrc1_balance(&ic, token_a_ledger_id, kong_account);
    let kong_balance_b_after_direct_swap_a = get_icrc1_balance(&ic, token_b_ledger_id, kong_account);

    // Expected User A: Unchanged from after the direct transfer
    assert_eq!(
        user_balance_a_after_direct_swap_a, user_balance_a_after_direct_transfer,
        "User balance A after direct swap A->B (should be same as after transfer)"
    );

    // Expected User B: BalanceBeforeDirectSwap + AmountReceivedB
    let expected_user_b_after_direct_swap_a = user_balance_b_before_direct_swap.clone() + amount_out_b_actual_direct.clone();
    assert_eq!(
        user_balance_b_after_direct_swap_a, expected_user_b_after_direct_swap_a,
        "User balance B after direct swap A->B. Expected {}, got {}",
        expected_user_b_after_direct_swap_a, user_balance_b_after_direct_swap_a
    );

    // Expected Kong A: BalanceBeforeDirectSwap + PayAmount (from user's direct transfer)
    let expected_kong_a_after_direct_swap_a = kong_balance_a_before_direct_swap.clone() + direct_swap_amount_a.clone();
    assert_eq!(
        kong_balance_a_after_direct_swap_a, expected_kong_a_after_direct_swap_a,
        "Kong balance A after direct swap A->B"
    );
    // Expected Kong B: BalanceBeforeDirectSwap - AmountReceivedB - TransferFeeB
    let expected_kong_b_after_direct_swap_a =
        kong_balance_b_before_direct_swap.clone() - amount_out_b_actual_direct.clone() - Nat::from(TOKEN_B_FEE_ICP);
    assert_eq!(
        kong_balance_b_after_direct_swap_a, expected_kong_b_after_direct_swap_a,
        "Kong balance B after direct swap A->B"
    );
    println!(
        "  User Balance A: {}, User Balance B: {}",
        user_balance_a_after_direct_swap_a, user_balance_b_after_direct_swap_a
    );
    println!(
        "  Kong Balance A: {}, Kong Balance B: {}",
        kong_balance_a_after_direct_swap_a, kong_balance_b_after_direct_swap_a
    );

    // --- Phase 8: Swap B -> A with Direct Transfer ---
    println!("\n--- Phase 8: Swap B -> A with Direct Transfer ---");
    let direct_swap_amount_b = Nat::from(base_direct_swap_b);
    let amount_out_min_a_direct_swap = Nat::from(1u64); // Expect at least 1 tiny unit of A out

    // Get balances before direct transfer swap B->A
    let user_balance_a_before_direct_swap_b = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_before_direct_swap_b = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let kong_balance_a_before_direct_swap_b = get_icrc1_balance(&ic, token_a_ledger_id, kong_account);
    let kong_balance_b_before_direct_swap_b = get_icrc1_balance(&ic, token_b_ledger_id, kong_account);
    println!("--- Balances BEFORE Direct Transfer Swap (B -> A) ---");
    println!(
        "  User Balance A: {}, User Balance B: {}",
        user_balance_a_before_direct_swap_b, user_balance_b_before_direct_swap_b
    );
    println!(
        "  Kong Balance A: {}, Kong Balance B: {}",
        kong_balance_a_before_direct_swap_b, kong_balance_b_before_direct_swap_b
    );

    // User transfers Token B directly to Kong for the swap
    println!("\n--- User transferring Token B directly to Kong for swap ---");
    let transfer_direct_swap_b_args = TransferArg {
        from_subaccount: None,
        to: kong_account, // Send TO Kong
        amount: direct_swap_amount_b.clone(),
        fee: None, // Use default fee
        memo: None,
        created_at_time: None,
    };
    let transfer_direct_swap_b_payload = encode_one(transfer_direct_swap_b_args).expect("Failed to encode transfer_direct_swap_b_args");
    let transfer_direct_swap_b_response = ic
        .update_call(
            token_b_ledger_id, // Use Token B ledger
            user_principal,
            "icrc1_transfer",
            transfer_direct_swap_b_payload,
        ) // Called by USER
        .expect("Failed to call icrc1_transfer for Token B direct swap");
    let transfer_direct_swap_b_result = decode_one::<Result<Nat, TransferError>>(&transfer_direct_swap_b_response)
        .expect("Failed to decode icrc1_transfer response for Token B direct swap");
    assert!(
        transfer_direct_swap_b_result.is_ok(),
        "User transfer Token B for direct swap failed: {:?}",
        transfer_direct_swap_b_result
    );
    let tx_id_direct_swap_b = transfer_direct_swap_b_result.unwrap(); // Capture the block index (tx_id)
    println!("  Token B direct transfer for swap successful, Tx ID: {}", tx_id_direct_swap_b);

    // Check user balance B immediately after transfer (before swap call)
    let user_balance_b_after_direct_transfer = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let expected_user_b_after_direct_transfer =
        user_balance_b_before_direct_swap_b.clone() - direct_swap_amount_b.clone() - Nat::from(TOKEN_B_FEE_ICP);
    assert_eq!(
        user_balance_b_after_direct_transfer, expected_user_b_after_direct_transfer,
        "User balance B after direct transfer, before swap call"
    );

    // Perform the Swap (Token B -> Token A using direct transfer tx_id)
    println!("\n--- Calling swap (Direct Transfer Flow B -> A) ---");
    let swap_args_direct_b = SwapArgs {
        pay_token: token_b_str.clone(), // Pay with B
        pay_amount: direct_swap_amount_b.clone(),
        pay_tx_id: Some(TxId::BlockIndex(tx_id_direct_swap_b)), // Provide the tx_id
        receive_token: token_a_str.clone(),                     // Receive A
        receive_amount: Some(amount_out_min_a_direct_swap.clone()), // Minimum expected A
        receive_address: Some(user_principal.to_text()),        // Explicitly set receive address
        max_slippage: Some(50.0),                               // Explicitly allow up to 50% slippage
        referred_by: None,
    };
    let swap_payload_direct_b = encode_one(&swap_args_direct_b).expect("Failed to encode swap_args_direct_b ");

    let swap_response_bytes_direct_b = ic
        .update_call(kong_backend, user_principal, "swap", swap_payload_direct_b)
        .expect("Failed to call swap (direct flow B->A)");

    let swap_result_direct_b = decode_one::<Result<SwapReply, String>>(&swap_response_bytes_direct_b)
        .expect("Failed to decode swap_transfer response (direct flow B->A)");

    println!("Swap result (direct flow B->A): {:?}", swap_result_direct_b);
    assert!(
        swap_result_direct_b.is_ok(),
        "swap_transfer call failed (direct flow B->A): {:?}",
        swap_result_direct_b
    );
    let swap_reply_direct_b = swap_result_direct_b.unwrap();
    let amount_out_a_actual_direct = swap_reply_direct_b.receive_amount;

    // Check minimum amount requirement
    assert!(
        amount_out_a_actual_direct >= amount_out_min_a_direct_swap,
        "Actual amount out ({}) is less than minimum expected ({}) in direct swap B->A",
        amount_out_a_actual_direct,
        amount_out_min_a_direct_swap
    );

    // Verify Balances After Direct Transfer Swap (B -> A)
    println!("\n--- Balances AFTER Direct Transfer Swap (B -> A) ---");
    let user_balance_a_after_direct_swap_b = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_after_direct_swap_b = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let kong_balance_a_after_direct_swap_b = get_icrc1_balance(&ic, token_a_ledger_id, kong_account);
    let kong_balance_b_after_direct_swap_b = get_icrc1_balance(&ic, token_b_ledger_id, kong_account);

    // Expected User B: Unchanged from after the direct transfer
    assert_eq!(
        user_balance_b_after_direct_swap_b, user_balance_b_after_direct_transfer,
        "User balance B after direct swap B->A (should be same as after transfer)"
    );

    // Expected User A: BalanceBeforeDirectSwapB + AmountReceivedA
    let expected_user_a_after_direct_swap_b = user_balance_a_before_direct_swap_b.clone() + amount_out_a_actual_direct.clone();
    assert_eq!(
        user_balance_a_after_direct_swap_b, expected_user_a_after_direct_swap_b,
        "User balance A after direct swap B->A. Expected {}, got {}",
        expected_user_a_after_direct_swap_b, user_balance_a_after_direct_swap_b
    );

    // Expected Kong B: BalanceBeforeDirectSwapB + PayAmountB (from user's direct transfer)
    let expected_kong_b_after_direct_swap_b = kong_balance_b_before_direct_swap_b.clone() + direct_swap_amount_b.clone();
    assert_eq!(
        kong_balance_b_after_direct_swap_b, expected_kong_b_after_direct_swap_b,
        "Kong balance B after direct swap B->A"
    );
    // Expected Kong A: BalanceBeforeDirectSwapB - AmountReceivedA - TransferFeeA
    let expected_kong_a_after_direct_swap_b =
        kong_balance_a_before_direct_swap_b.clone() - amount_out_a_actual_direct.clone() - Nat::from(TOKEN_A_FEE);
    assert_eq!(
        kong_balance_a_after_direct_swap_b, expected_kong_a_after_direct_swap_b,
        "Kong balance A after direct swap B->A"
    );
    println!(
        "  User Balance A: {}, User Balance B: {}",
        user_balance_a_after_direct_swap_b, user_balance_b_after_direct_swap_b
    );
    println!(
        "  Kong Balance A: {}, Kong Balance B: {}",
        kong_balance_a_after_direct_swap_b, kong_balance_b_after_direct_swap_b
    );

    println!("\n--- test_swap_a_to_b_happy_path finished successfully! ---");
}
