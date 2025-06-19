// src/kong_backend/tests/test_swap.rs
pub mod common;

// --- Imports ---
use anyhow::Result;
use candid::{decode_one, encode_one, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};

// Use the common setup function that includes pool creation
use common::setup_with_pool::{
    setup_swap_test_environment,
    TOKEN_A_SYMBOL,
    TOKEN_B_SYMBOL_ICP,
    TOKEN_A_FEE,
    TOKEN_B_FEE_ICP,
};

// Import kong_backend types needed for tests
use kong_backend::stable_transfer::tx_id::TxId;
use kong_backend::swap::swap_args::SwapArgs;
use kong_backend::swap::swap_reply::SwapReply;

// --- Balance Check Helper (used by multiple tests) ---
// This function works for both ICRC1 tokens and ICP ledger (which implements ICRC1 interface)
fn get_icrc1_balance(ic: &pocket_ic::PocketIc, ledger_id: Principal, account: Account) -> Nat {
    let payload = encode_one(account).expect("Failed to encode account for balance_of");
    let response = ic
        .query_call(ledger_id, Principal::anonymous(), "icrc1_balance_of", payload)
        .expect("Failed to call icrc1_balance_of");
    decode_one::<Nat>(&response).expect("Failed to decode icrc1_balance_of response")
}

// --- Test Functions ---

#[test]
fn test_swap_approve_transfer_from_a_to_b() {
    // --- Arrange ---
    // Use the common setup function
    let setup = setup_swap_test_environment().expect("Failed to setup swap test environment");
    let ic = setup.ic;
    let kong_backend = setup.kong_backend;
    let user_principal = setup.user_principal;
    let user_account = setup.user_account;
    let kong_account = setup.kong_account;
    let token_a_ledger_id = setup.token_a_ledger_id;
    let token_b_ledger_id = setup.token_b_ledger_id;
    let token_a_str = setup.token_a_str;
    let token_b_str = setup.token_b_str;

    let approve_swap_amount_a = setup.base_approve_swap_a;
    let amount_out_min_b_approve_swap = Nat::from(1u64); // Expect at least 1 tiny unit of B out

    // --- Act ---
    println!("\n--- Test: Swap A -> B (Approve/TransferFrom) ---");

    // 1. Approve Token A for Swap
    println!("--- Approving Token A for Approve/TransferFrom Swap ---");
    let approve_total_amount_a = approve_swap_amount_a.clone() + Nat::from(TOKEN_A_FEE); // Amount + fee for subsequent transfer_from
    let approve_args_swap_a = ApproveArgs {
        from_subaccount: None,
        spender: kong_account, // Approve Kong backend to spend
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

    // Get balances *before* the swap call (after approve)
    let user_balance_a_before_swap = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_before_swap = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let kong_balance_a_before_swap = get_icrc1_balance(&ic, token_a_ledger_id, kong_account);
    let kong_balance_b_before_swap = get_icrc1_balance(&ic, token_b_ledger_id, kong_account);
    println!("--- Balances BEFORE Swap Call (After Approve) ---");
    println!(
        "  User Balance A: {}, User Balance B: {}",
         user_balance_a_before_swap, user_balance_b_before_swap
    );
     println!(
        "  Kong Balance A: {}, Kong Balance B: {}",
         kong_balance_a_before_swap, kong_balance_b_before_swap
    );

    // 2. Perform the Swap (Token A -> Token B using transfer_from)
    println!("\n--- Calling swap (Approve/TransferFrom Flow) ---");
    let swap_args_approve = SwapArgs {
        pay_token: token_a_str.clone(),
        pay_amount: Nat::from(approve_swap_amount_a), // The actual amount to swap
        pay_tx_id: None,                           // Swap uses transfer_from, so no tx_id needed here
        receive_token: token_b_str.clone(),
        receive_amount: Some(amount_out_min_b_approve_swap.clone()), // Minimum expected
        receive_address: Some(user_principal.to_text()),             // Explicitly set receive address
        max_slippage: Some(50.0),                                    // Explicitly allow up to 50% slippage for this test
        referred_by: None,
        ..Default::default()
    };
    let swap_payload_approve = encode_one(&swap_args_approve).expect("Failed to encode swap_args_approve ");

    let swap_response_bytes_approve = ic
        .update_call(kong_backend, user_principal, "swap", swap_payload_approve)
        .expect("Failed to call swap (approve flow)");

    // --- Assert ---
    let swap_result_approve =
        decode_one::<Result<SwapReply, String>>(&swap_response_bytes_approve).expect("Failed to decode swap_transfer response (approve flow)");

    println!("Swap result (approve flow): {:?}", swap_result_approve); // Debug print

    assert!(
        swap_result_approve.is_ok(),
        "swap_transfer call failed (approve flow): {:?}\nArgs: {:?}",
        swap_result_approve, swap_args_approve
    );
    let swap_reply_approve = swap_result_approve.unwrap(); // Unwrap the Ok result
    let amount_out_b_actual_approve = swap_reply_approve.receive_amount; // Get actual amount from reply

    // Check minimum amount
    assert!(
        amount_out_b_actual_approve >= amount_out_min_b_approve_swap,
        "Actual amount out ({}) is less than minimum expected ({}) in approve swap",
        amount_out_b_actual_approve,
        amount_out_min_b_approve_swap
    );

    // Verify Balances After Swap
    println!("\n--- Balances AFTER Approve/TransferFrom Swap ---");
    let user_balance_a_after_approve_swap = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_after_approve_swap = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let kong_balance_a_after_approve_swap = get_icrc1_balance(&ic, token_a_ledger_id, kong_account); // Check Kong
    let kong_balance_b_after_approve_swap = get_icrc1_balance(&ic, token_b_ledger_id, kong_account); // Check Kong

    // Expected User A: BalanceBeforeSwap - SwapAmountIn - SwapTransferFromFee (paid from approved amount)
    // Note: User already paid approve fee before 'BalanceBeforeSwap' snapshot
    let expected_user_a_after_approve_swap = user_balance_a_before_swap.clone() - approve_swap_amount_a.clone() - Nat::from(TOKEN_A_FEE);
    assert_eq!(
        user_balance_a_after_approve_swap, expected_user_a_after_approve_swap,
        "User balance A after approve/transfer_from swap. Expected {}, got {}",
        expected_user_a_after_approve_swap, user_balance_a_after_approve_swap
    );

    // Expected User B: BalanceBeforeSwap + AmountReceivedB
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
        "Kong balance A after approve/transfer_from swap. Expected {}, got {}",
        expected_kong_a_after_approve_swap, kong_balance_a_after_approve_swap
    );
    // Expected Kong B: BalanceBeforeSwap - AmountReceivedB - TransferFeeB (Kong pays this)
    let expected_kong_b_after_approve_swap =
        kong_balance_b_before_swap.clone() - amount_out_b_actual_approve.clone() - Nat::from(TOKEN_B_FEE_ICP);
    assert_eq!(
        kong_balance_b_after_approve_swap, expected_kong_b_after_approve_swap,
        "Kong balance B after approve/transfer_from swap. Expected {}, got {}",
        expected_kong_b_after_approve_swap, kong_balance_b_after_approve_swap
    );

    println!(
        "  User Balance A ({}): {}",
        TOKEN_A_SYMBOL, user_balance_a_after_approve_swap
    );
    println!(
        "  User Balance B ({}): {}",
        TOKEN_B_SYMBOL_ICP, user_balance_b_after_approve_swap
    );
    println!(
        "  Kong Balance A ({}): {}",
        TOKEN_A_SYMBOL, kong_balance_a_after_approve_swap
    );
    println!(
        "  Kong Balance B ({}): {}",
        TOKEN_B_SYMBOL_ICP, kong_balance_b_after_approve_swap
    );
    println!("\n--- Test: test_swap_approve_transfer_from_a_to_b finished successfully! ---");
}


#[test]
fn test_swap_direct_transfer_a_to_b() {
    // --- Arrange ---
    // Use the common setup function
    let setup = setup_swap_test_environment().expect("Failed to setup swap test environment");
    let ic = setup.ic;
    let kong_backend = setup.kong_backend;
    let user_principal = setup.user_principal;
    let user_account = setup.user_account;
    let kong_account = setup.kong_account;
    let token_a_ledger_id = setup.token_a_ledger_id;
    let token_b_ledger_id = setup.token_b_ledger_id;
    let token_a_str = setup.token_a_str;
    let token_b_str = setup.token_b_str;

    let direct_swap_amount_a = setup.base_transfer_swap_a;
    let amount_out_min_b_direct_swap = Nat::from(1u64);

    // Get balances before direct transfer swap
    let user_balance_a_before_direct_swap = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_before_direct_swap = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let kong_balance_a_before_direct_swap = get_icrc1_balance(&ic, token_a_ledger_id, kong_account);
    let kong_balance_b_before_direct_swap = get_icrc1_balance(&ic, token_b_ledger_id, kong_account);

    println!("\n--- Test: Swap A -> B (Direct Transfer) ---");
    println!("--- Balances BEFORE Direct Transfer Swap (A -> B) ---");
    println!(
        "  User Balance A: {}, User Balance B: {}",
        user_balance_a_before_direct_swap, user_balance_b_before_direct_swap
    );
    println!(
        "  Kong Balance A: {}, Kong Balance B: {}",
        kong_balance_a_before_direct_swap, kong_balance_b_before_direct_swap
    );

    // --- Act ---
    // 1. User transfers Token A directly to Kong for the swap
    println!("\n--- User transferring Token A directly to Kong for swap ---");
    let transfer_direct_swap_a_args = TransferArg {
        from_subaccount: None,
        to: kong_account, // Send TO Kong
        amount: Nat::from(direct_swap_amount_a),
        fee: None, // Use default fee (User pays this)
        memo: None,
        created_at_time: None,
    };
    let transfer_direct_swap_a_payload =
        encode_one(transfer_direct_swap_a_args).expect("Failed to encode transfer_direct_swap_a_args");
    let transfer_direct_swap_a_response = ic
        .update_call(
            token_a_ledger_id,
            user_principal,
            "icrc1_transfer",
            transfer_direct_swap_a_payload,
        ) // Called by USER
        .expect("Failed to call icrc1_transfer for Token A direct swap");
    let transfer_direct_swap_a_result = decode_one::<Result<Nat, TransferError>>(&transfer_direct_swap_a_response)
        .expect("Failed to decode icrc1_transfer response for Token A direct swap");
    assert!(
        transfer_direct_swap_a_result.is_ok(),
        "User transfer Token A for direct swap failed: {:?}",
        transfer_direct_swap_a_result
    );
    let tx_id_direct_swap_a = transfer_direct_swap_a_result.unwrap(); // Capture the block index (tx_id)
    println!(
        "  Token A direct transfer for swap successful, Tx ID: {}",
        tx_id_direct_swap_a
    );

    // Check user balance A immediately after transfer (before swap call)
    let user_balance_a_after_direct_transfer = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let expected_user_a_after_direct_transfer =
        user_balance_a_before_direct_swap.clone() - direct_swap_amount_a.clone() - Nat::from(TOKEN_A_FEE);
    assert_eq!(
        user_balance_a_after_direct_transfer, expected_user_a_after_direct_transfer,
        "User balance A after direct transfer, before swap call. Expected {}, got {}",
        expected_user_a_after_direct_transfer, user_balance_a_after_direct_transfer
    );

     // 2. Perform the Swap (Token A -> Token B using direct transfer tx_id)
    println!("\n--- Calling swap (Direct Transfer Flow A -> B) ---");
    let swap_args_direct_a = SwapArgs {
        pay_token: token_a_str.clone(),
        pay_amount: Nat::from(direct_swap_amount_a),
        pay_tx_id: Some(TxId::BlockIndex(tx_id_direct_swap_a)), // Provide the tx_id
        receive_token: token_b_str.clone(),
        receive_amount: Some(amount_out_min_b_direct_swap.clone()), // Minimum expected
        receive_address: Some(user_principal.to_text()),           // Explicitly set receive address
        max_slippage: Some(50.0),                                  // Explicitly allow up to 50% slippage
        referred_by: None,
        ..Default::default()
    };
    let swap_payload_direct_a = encode_one(&swap_args_direct_a).expect("Failed to encode swap_args_direct_a ");

    let swap_response_bytes_direct_a = ic
        .update_call(kong_backend, user_principal, "swap", swap_payload_direct_a)
        .expect("Failed to call swap (direct flow A->B)");

    // --- Assert ---
    let swap_result_direct_a = decode_one::<Result<SwapReply, String>>(&swap_response_bytes_direct_a)
        .expect("Failed to decode swap_transfer response (direct flow A->B)");

    println!("Swap result (direct flow A->B): {:?}\nArgs: {:?}", swap_result_direct_a, swap_args_direct_a);
    assert!(
        swap_result_direct_a.is_ok(),
        "swap_transfer call failed (direct flow A->B): {:?}\nArgs: {:?}",
        swap_result_direct_a, swap_args_direct_a
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
        "User balance A after direct swap A->B (should be same as after transfer). Expected {}, got {}",
        user_balance_a_after_direct_transfer, user_balance_a_after_direct_swap_a
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
        "Kong balance A after direct swap A->B. Expected {}, got {}",
        expected_kong_a_after_direct_swap_a, kong_balance_a_after_direct_swap_a
    );
    // Expected Kong B: BalanceBeforeDirectSwap - AmountReceivedB - TransferFeeB (Kong pays this)
    let expected_kong_b_after_direct_swap_a =
        kong_balance_b_before_direct_swap.clone() - amount_out_b_actual_direct.clone() - Nat::from(TOKEN_B_FEE_ICP);
    assert_eq!(
        kong_balance_b_after_direct_swap_a, expected_kong_b_after_direct_swap_a,
        "Kong balance B after direct swap A->B. Expected {}, got {}",
        expected_kong_b_after_direct_swap_a, kong_balance_b_after_direct_swap_a
    );
    println!(
        "  User Balance A: {}, User Balance B: {}",
        user_balance_a_after_direct_swap_a, user_balance_b_after_direct_swap_a
    );
    println!(
        "  Kong Balance A: {}, Kong Balance B: {}",
        kong_balance_a_after_direct_swap_a, kong_balance_b_after_direct_swap_a
    );
    println!("\n--- Test: test_swap_direct_transfer_a_to_b finished successfully! ---");
}


#[test]
fn test_swap_direct_transfer_b_to_a() {
    // --- Arrange ---
    // Use the common setup function
    let setup = setup_swap_test_environment().expect("Failed to setup swap test environment");
    let ic = setup.ic;
    let kong_backend = setup.kong_backend;
    let user_principal = setup.user_principal;
    let user_account = setup.user_account;
    let kong_account = setup.kong_account;
    let token_a_ledger_id = setup.token_a_ledger_id;
    let token_b_ledger_id = setup.token_b_ledger_id;
    let token_a_str = setup.token_a_str;
    let token_b_str = setup.token_b_str;

    let direct_swap_amount_b = setup.base_transfer_swap_b;
    let amount_out_min_a_direct_swap = Nat::from(1u64); // Expect at least 1 tiny unit of A out

    // Get balances before direct transfer swap B->A
    let user_balance_a_before_direct_swap_b = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    let user_balance_b_before_direct_swap_b = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let kong_balance_a_before_direct_swap_b = get_icrc1_balance(&ic, token_a_ledger_id, kong_account);
    let kong_balance_b_before_direct_swap_b = get_icrc1_balance(&ic, token_b_ledger_id, kong_account);

    println!("\n--- Test: Swap B -> A (Direct Transfer) ---");
    println!("--- Balances BEFORE Direct Transfer Swap (B -> A) ---");
    println!(
        "  User Balance A: {}, User Balance B: {}",
        user_balance_a_before_direct_swap_b, user_balance_b_before_direct_swap_b
    );
    println!(
        "  Kong Balance A: {}, Kong Balance B: {}",
        kong_balance_a_before_direct_swap_b, kong_balance_b_before_direct_swap_b
    );

    // --- Act ---
    // 1. User transfers Token B directly to Kong for the swap
    println!("\n--- User transferring Token B directly to Kong for swap ---");
    let transfer_direct_swap_b_args = TransferArg {
        from_subaccount: None,
        to: kong_account, // Send TO Kong
        amount: Nat::from(direct_swap_amount_b),
        fee: None, // Use default fee (User pays this)
        memo: None,
        created_at_time: None,
    };
    let transfer_direct_swap_b_payload =
        encode_one(transfer_direct_swap_b_args).expect("Failed to encode transfer_direct_swap_b_args");
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
    println!(
        "  Token B direct transfer for swap successful, Tx ID: {}",
        tx_id_direct_swap_b
    );

    // Check user balance B immediately after transfer (before swap call)
    let user_balance_b_after_direct_transfer = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    let expected_user_b_after_direct_transfer =
        user_balance_b_before_direct_swap_b.clone() - direct_swap_amount_b.clone() - Nat::from(TOKEN_B_FEE_ICP);
    assert_eq!(
        user_balance_b_after_direct_transfer, expected_user_b_after_direct_transfer,
        "User balance B after direct transfer, before swap call. Expected {}, got {}",
        expected_user_b_after_direct_transfer, user_balance_b_after_direct_transfer
    );

    // 2. Perform the Swap (Token B -> Token A using direct transfer tx_id)
    println!("\n--- Calling swap (Direct Transfer Flow B -> A) ---");
    let swap_args_direct_b = SwapArgs {
        pay_token: token_b_str.clone(), // Pay with B
        pay_amount: Nat::from(direct_swap_amount_b),
        pay_tx_id: Some(TxId::BlockIndex(tx_id_direct_swap_b)), // Provide the tx_id
        receive_token: token_a_str.clone(),                     // Receive A
        receive_amount: Some(amount_out_min_a_direct_swap.clone()), // Minimum expected A
        receive_address: Some(user_principal.to_text()),        // Explicitly set receive address
        max_slippage: Some(50.0),                               // Explicitly allow up to 50% slippage
        referred_by: None,
        ..Default::default()
    };
    let swap_payload_direct_b = encode_one(&swap_args_direct_b).expect("Failed to encode swap_args_direct_b ");

    let swap_response_bytes_direct_b = ic
        .update_call(kong_backend, user_principal, "swap", swap_payload_direct_b)
        .expect("Failed to call swap (direct flow B->A)");

    // --- Assert ---
    let swap_result_direct_b = decode_one::<Result<SwapReply, String>>(&swap_response_bytes_direct_b)
        .expect("Failed to decode swap_transfer response (direct flow B->A)");

    println!("Swap result (direct flow B->A): {:?}\nArgs: {:?}", swap_result_direct_b, swap_args_direct_b);
    assert!(
        swap_result_direct_b.is_ok(),
        "swap_transfer call failed (direct flow B->A): {:?}\nArgs: {:?}",
        swap_result_direct_b, swap_args_direct_b
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
        "User balance B after direct swap B->A (should be same as after transfer). Expected {}, got {}",
        user_balance_b_after_direct_transfer, user_balance_b_after_direct_swap_b
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
        "Kong balance B after direct swap B->A. Expected {}, got {}",
        expected_kong_b_after_direct_swap_b, kong_balance_b_after_direct_swap_b
    );
    // Expected Kong A: BalanceBeforeDirectSwapB - AmountReceivedA - TransferFeeA (Kong pays this)
    let expected_kong_a_after_direct_swap_b =
        kong_balance_a_before_direct_swap_b.clone() - amount_out_a_actual_direct.clone() - Nat::from(TOKEN_A_FEE);
    assert_eq!(
        kong_balance_a_after_direct_swap_b, expected_kong_a_after_direct_swap_b,
        "Kong balance A after direct swap B->A. Expected {}, got {}",
        expected_kong_a_after_direct_swap_b, kong_balance_a_after_direct_swap_b
    );
    println!(
        "  User Balance A: {}, User Balance B: {}",
        user_balance_a_after_direct_swap_b, user_balance_b_after_direct_swap_b
    );
    println!(
        "  Kong Balance A: {}, Kong Balance B: {}",
        kong_balance_a_after_direct_swap_b, kong_balance_b_after_direct_swap_b
    );

    println!("\n--- Test: test_swap_direct_transfer_b_to_a finished successfully! ---");
}

