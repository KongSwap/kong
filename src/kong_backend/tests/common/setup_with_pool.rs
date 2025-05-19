// --- Imports ---
use anyhow::{Context, Result};
use candid::{decode_one, encode_one, Nat, Principal};
use ic_ledger_types::{AccountIdentifier, Subaccount};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

use super::icrc1_ledger::{create_icrc1_ledger, ArchiveOptions, FeatureFlags, InitArgs, LedgerArg};
use super::icp_ledger::{create_icp_ledger_with_id, ArchiveOptions as ICPArchiveOptions, InitArgs as ICPInitArgs, LedgerArg as ICPLedgerArg};
use super::identity::{get_identity_from_pem_file, get_new_identity};
use super::setup::{setup_ic_environment, CONTROLLER_PEM_FILE};

// Import kong_backend types needed for setup
use kong_backend::add_pool::add_pool_args::AddPoolArgs;
use kong_backend::add_pool::add_pool_reply::AddPoolReply;
use kong_backend::add_token::add_token_args::AddTokenArgs;
use kong_backend::add_token::add_token_reply::AddTokenReply;
use kong_backend::pools::pools_reply::PoolReply;
use kong_backend::stable_transfer::tx_id::TxId;

// --- Constants needed for setup ---
pub const TOKEN_A_SYMBOL: &str = "SWPA"; // Swap Test Token A
pub const TOKEN_A_NAME: &str = "Swap Test Token A";
pub const TOKEN_A_FEE: u64 = 10_000;
pub const TOKEN_A_DECIMALS: u8 = 8;

pub const TOKEN_B_SYMBOL_ICP: &str = "ICP"; // Mock ICP
pub const TOKEN_B_NAME_ICP: &str = "Internet Computer Protocol (Swap Test)";
pub const TOKEN_B_FEE_ICP: u64 = 10_000;
pub const TOKEN_B_DECIMALS_ICP: u8 = 8;

// --- Helper Function (if needed only within setup) ---
fn get_icrc1_balance_internal(ic: &pocket_ic::PocketIc, ledger_id: Principal, account: Account) -> Nat {
    let payload = encode_one(account).expect("Failed to encode account for balance_of");
    let response = ic
        .query_call(ledger_id, Principal::anonymous(), "icrc1_balance_of", payload)
        .expect("Failed to call icrc1_balance_of");
    decode_one::<Nat>(&response).expect("Failed to decode icrc1_balance_of response")
}

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
    // Initial balances after setup and liquidity provision
    pub initial_user_balance_a: Nat,
    pub initial_user_balance_b: Nat,
    pub initial_kong_balance_a: Nat,
    pub initial_kong_balance_b: Nat,
    // Amounts used during setup that might be needed by tests
    pub base_approve_swap_a_amount: Nat,
    pub base_direct_swap_a_amount: Nat,
    pub base_direct_swap_b_amount: Nat,
}

// --- Test Setup Function ---
pub fn setup_swap_test_environment() -> Result<SwapTestSetup> {
    // --- Phase 1: Setup Environment, Identities, Ledgers ---
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
        .context("Failed to create Token A ledger")?;

    // Create Token B (Mock ICP) Ledger with actual ICP ledger implementation
    let token_b_principal_id = Principal::from_text("nppha-riaaa-aaaal-ajf2q-cai").expect("Invalid Testnet ICP Principal ID"); // Use Testnet ICP ID
    
    // Create account identifier for controller
    let controller_account_id = AccountIdentifier::new(&controller_principal, &Subaccount([0; 32]));
    
    // Build ICP-specific init args
    let token_b_icp_init_args = ICPInitArgs {
        minting_account: controller_account_id.to_string(),
        icrc1_minting_account: Some(controller_account),
        initial_values: vec![],
        max_message_size_bytes: None,
        transaction_window: None,
        archive_options: Some(ICPArchiveOptions {
            num_blocks_to_archive: 1000,
            trigger_threshold: 500,
            max_transactions_per_response: None,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: controller_principal,
            more_controller_ids: None,
        }),
        send_whitelist: vec![],
        transfer_fee: Some(super::icp_ledger::Tokens { e8s: TOKEN_B_FEE_ICP }),
        token_symbol: Some(TOKEN_B_SYMBOL_ICP.to_string()),
        token_name: Some(TOKEN_B_NAME_ICP.to_string()),
        feature_flags: Some(super::icp_ledger::FeatureFlags { icrc2: true }),
    };
    
    let token_b_ledger_id = create_icp_ledger_with_id(
        &ic,
        token_b_principal_id,
        controller_principal,
        &ICPLedgerArg::Init(token_b_icp_init_args),
    )
    .map_err(anyhow::Error::msg) // Map String error
    .context("Failed to create ICP ledger for Token B")?;
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
        .map_err(anyhow::Error::msg) // Map PocketIc error
        .context("Failed to call add_token for Token A")?;
    let result_a = decode_one::<Result<AddTokenReply, String>>(&response_a).expect("Failed to decode add_token response for Token A");
    assert!(result_a.is_ok(), "add_token for Token A failed: {:?}", result_a);

    let token_b_str = format!("IC.{}", token_b_ledger_id.to_text());
    let add_token_b_args = AddTokenArgs {
        token: token_b_str.clone(),
    };
    let args_token_b = encode_one(&add_token_b_args).expect("Failed to encode add_token_b_args");
    let response_token_b = ic
        .update_call(kong_backend, controller_principal, "add_token", args_token_b)
        .map_err(anyhow::Error::msg) // Map PocketIc error
        .context("Failed to call add_token for Token B (ICP)")?;
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

    // Calculate total fees needed for Token A (User pays these initially)
    let total_fees_a = Nat::from(TOKEN_A_FEE * 5); // Adjusted as before

    // Calculate total fees needed for Token B (User pays these initially)
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
        .map_err(anyhow::Error::msg) // Map PocketIc error
        .context("Failed to mint Token A")?;
    let transfer_result_a =
        decode_one::<Result<Nat, TransferError>>(&transfer_response_a).expect("Failed to decode icrc1_transfer response for Token A");
    assert!(transfer_result_a.is_ok(), "Minting Token A failed: {:?}", transfer_result_a);
    let user_balance_a_after_mint = get_icrc1_balance_internal(&ic, token_a_ledger_id, user_account);
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
        .map_err(anyhow::Error::msg) // Map PocketIc error
        .context("Failed to mint Token B")?;
    let transfer_result_b =
        decode_one::<Result<Nat, TransferError>>(&transfer_response_b).expect("Failed to decode icrc1_transfer response for Token B");
    assert!(transfer_result_b.is_ok(), "Minting Token B failed: {:?}", transfer_result_b);
    let user_balance_b_after_mint = get_icrc1_balance_internal(&ic, token_b_ledger_id, user_account);
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
        .update_call(token_a_ledger_id, user_principal, "icrc1_transfer", transfer_liq_a_payload)
        .map_err(anyhow::Error::msg) // Map PocketIc error
        .context("Failed transfer Token A liquidity")?; // Called by USER
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
        .update_call(token_b_ledger_id, user_principal, "icrc1_transfer", transfer_liq_b_payload)
        .map_err(anyhow::Error::msg) // Map PocketIc error
        .context("Failed transfer Token B liquidity")?; // Called by USER
    let transfer_liq_b_result = decode_one::<Result<Nat, TransferError>>(&transfer_liq_b_response)
        .expect("Failed to decode icrc1_transfer response for Token B liquidity");
    assert!(
        transfer_liq_b_result.is_ok(),
        "User transfer Token B liquidity failed: {:?}",
        transfer_liq_b_result
    );
    let tx_id_b = transfer_liq_b_result.unwrap(); // Capture the block index (tx_id)
    println!("  Token B liquidity transfer successful, Tx ID: {}", tx_id_b);

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
        .map_err(anyhow::Error::msg) // Map PocketIc error
        .context("Failed to call add_pool")?;
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
        .map_err(anyhow::Error::msg) // Map PocketIc error
        .context("Failed to call 'pools' query")?;
    let pools_result = decode_one::<Result<Vec<PoolReply>, String>>(&pools_response_bytes).expect("Failed to decode 'pools' response");
    assert!(pools_result.is_ok(), "Querying pools failed: {:?}", pools_result);
    assert!(
        !pools_result.unwrap().is_empty(),
        "Pool list should not be empty after adding liquidity"
    );

    // --- Final state after setup ---
    let initial_user_balance_a = get_icrc1_balance_internal(&ic, token_a_ledger_id, user_account);
    let initial_user_balance_b = get_icrc1_balance_internal(&ic, token_b_ledger_id, user_account);
    let initial_kong_balance_a = get_icrc1_balance_internal(&ic, token_a_ledger_id, kong_account);
    let initial_kong_balance_b = get_icrc1_balance_internal(&ic, token_b_ledger_id, kong_account);

    println!("\n--- Balances AFTER Initial Setup & Add Pool ---");
    println!("  User Balance A ({}): {}", TOKEN_A_SYMBOL, initial_user_balance_a);
    println!("  User Balance B ({}): {}", TOKEN_B_SYMBOL_ICP, initial_user_balance_b);
    println!("  Kong Balance A ({}): {}", TOKEN_A_SYMBOL, initial_kong_balance_a);
    println!("  Kong Balance B ({}): {}", TOKEN_B_SYMBOL_ICP, initial_kong_balance_b);

    // Verify Kong balances are the liquidity amounts
    assert_eq!(initial_kong_balance_a, liquidity_amount_a, "Kong balance A after add_pool setup");
    assert_eq!(initial_kong_balance_b, liquidity_amount_b, "Kong balance B after add_pool setup");

    // Return the setup state
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
        initial_user_balance_a,
        initial_user_balance_b,
        initial_kong_balance_a,
        initial_kong_balance_b,
        base_approve_swap_a_amount: Nat::from(base_approve_swap_a),
        base_direct_swap_a_amount: Nat::from(base_direct_swap_a),
        base_direct_swap_b_amount: Nat::from(base_direct_swap_b),
    })
}
