pub mod common;

use anyhow::Result;
use candid::{decode_one, encode_one, CandidType, Nat, Principal}; // Added CandidType
use icrc_ledger_types::icrc1::account::Account;
use serde::Deserialize; // Added Deserialize
use kong_backend::add_token::add_token_args::AddTokenArgs;
use kong_backend::add_token::add_token_reply::AddTokenReply;
use kong_backend::add_pool::add_pool_args::AddPoolArgs;
use kong_backend::add_pool::add_pool_reply::AddPoolReply;

use common::icrc1_ledger::{create_icrc1_ledger, create_icrc1_ledger_with_id, ArchiveOptions, FeatureFlags, InitArgs, LedgerArg};
use common::identity::{get_identity_from_pem_file, get_new_identity};
use common::setup::{setup_ic_environment, CONTROLLER_PEM_FILE};
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};
use icrc_ledger_types::icrc2::allowance::{AllowanceArgs, Allowance};

fn get_icrc1_balance(ic: &pocket_ic::PocketIc, ledger_id: candid::Principal, account: Account) -> Nat {
    let payload = encode_one(account).expect("Failed to encode account for balance_of");
    let response = ic.query_call(ledger_id, candid::Principal::anonymous(), "icrc1_balance_of", payload)
        .expect("Failed to call icrc1_balance_of");
    decode_one::<Nat>(&response).expect("Failed to decode icrc1_balance_of response")
}

fn get_icrc2_allowance(ic: &pocket_ic::PocketIc, ledger_id: candid::Principal, owner_account: Account, spender_account: Account) -> Allowance {
    let args = AllowanceArgs { account: owner_account, spender: spender_account };
    let payload = encode_one(args).expect("Failed to encode allowance args");
    let response = ic.query_call(ledger_id, candid::Principal::anonymous(), "icrc2_allowance", payload)
        .expect("Failed to call icrc2_allowance");
    decode_one::<Allowance>(&response).expect("Failed to decode icrc2_allowance response")
}

const TOKEN_A_SYMBOL: &str = "TKA";
const TOKEN_A_NAME: &str = "Test Token A";
const TOKEN_A_FEE: u64 = 10_000;
const TOKEN_A_DECIMALS: u8 = 8;

const TOKEN_B_SYMBOL_ICP: &str = "ICP";
const TOKEN_B_NAME_ICP: &str = "Internet Computer Protocol";
const TOKEN_B_FEE_ICP: u64 = 10_000;
const TOKEN_B_DECIMALS_ICP: u8 = 8;

#[test]
fn test_add_pool_setup() {
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    let controller_identity =
        get_identity_from_pem_file(CONTROLLER_PEM_FILE).expect("Failed to get controller identity");
    let controller_principal = controller_identity
        .sender()
        .expect("Failed to get controller principal");
    let controller_account = Account {
        owner: controller_principal,
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
        &Some(controller_principal),
        &LedgerArg::Init(token_a_init_args),
    )
    .expect("Failed to create Token A ledger");
    let _initial_controller_balance_a = get_icrc1_balance(&ic, token_a_ledger_id, controller_account);

    let token_b_principal_id = Principal::from_text("nppha-riaaa-aaaal-ajf2q-cai").expect("Invalid Testnet ICP Principal ID"); // Use Testnet ICP

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
    assert_eq!(token_b_ledger_id, token_b_principal_id, "Created ICP Ledger ID does not match specified ID");
    let _initial_controller_balance_b = get_icrc1_balance(&ic, token_b_ledger_id, controller_account);

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

    let user_identity = get_new_identity().expect("Failed to create new user identity");
    let user_principal = user_identity.sender().expect("Failed to get user principal");
    let user_account = Account {
        owner: user_principal,
        subaccount: None,
    };

    let token_b_str = format!("IC.{}", token_b_ledger_id.to_text());
    let add_token_b_args = AddTokenArgs {
        token: token_b_str.clone(),
    };
    let args_token_b = encode_one(&add_token_b_args).expect("Failed to encode add_token_b_args");

    let response_token_b = ic
        .update_call(kong_backend, controller_principal, "add_token", args_token_b)
        .expect("Failed to call add_token for Token B (ICP) by controller");

    let result_token_b = decode_one::<Result<AddTokenReply, String>>(&response_token_b)
        .expect("Failed to decode add_token response for Token B (ICP)");

    assert!(
        result_token_b.is_ok(),
        "add_token for Token B (ICP) should succeed, but got {:?}",
        result_token_b
    );

    let initial_user_balance_a = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    assert_eq!(initial_user_balance_a, Nat::from(0_u64), "Initial user balance for Token A should be 0");
    let initial_user_balance_b = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    assert_eq!(initial_user_balance_b, Nat::from(0_u64), "Initial user balance for Token B should be 0");

    let token_a_liquidity_amount = Nat::from(10_000 * 10u64.pow(TOKEN_A_DECIMALS as u32));
    let token_b_liquidity_amount = Nat::from(10_000 * 10u64.pow(TOKEN_B_DECIMALS_ICP as u32));

    let total_mint_amount_a = token_a_liquidity_amount.clone() + Nat::from(TOKEN_A_FEE) + Nat::from(TOKEN_A_FEE);

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
    let transfer_result_a = decode_one::<Result<Nat, TransferError>>(&transfer_response_a)
        .expect("Failed to decode icrc1_transfer response for Token A");
    assert!(
        transfer_result_a.is_ok(),
        "Minting Token A to user failed: {:?}",
        transfer_result_a
    );
    let user_balance_a_after_mint = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    assert_eq!(user_balance_a_after_mint, total_mint_amount_a, "User balance for Token A after minting is incorrect");

    let total_mint_amount_b = token_b_liquidity_amount.clone() + Nat::from(TOKEN_B_FEE_ICP) + Nat::from(TOKEN_B_FEE_ICP);

    let transfer_args_b = TransferArg {
        from_subaccount: None,
        to: user_account,
        amount: total_mint_amount_b.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };
    let transfer_payload_b = encode_one(transfer_args_b).expect("Failed to encode transfer_args_b for Token B (ICP)");
    let transfer_response_b = ic
        .update_call(token_b_ledger_id, controller_principal, "icrc1_transfer", transfer_payload_b)
        .expect("Failed to call icrc1_transfer for Token B (ICP)");
    let transfer_result_b = decode_one::<Result<Nat, TransferError>>(&transfer_response_b)
        .expect("Failed to decode icrc1_transfer response for Token B (ICP)");
    assert!(
        transfer_result_b.is_ok(),
        "Minting Token B (ICP) to user failed: {:?}",
        transfer_result_b
    );
    let user_balance_b_after_mint = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    assert_eq!(user_balance_b_after_mint, total_mint_amount_b, "User balance for Token B (ICP) after minting is incorrect");

    let approve_amount_a_orig = token_a_liquidity_amount.clone() + Nat::from(TOKEN_A_FEE);
    let approve_args_a = ApproveArgs {
        from_subaccount: None,
        spender: Account { owner: kong_backend, subaccount: None },
        amount: approve_amount_a_orig.clone(),
        expected_allowance: None,
        expires_at: None,
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
    let user_balance_a_after_approve = get_icrc1_balance(&ic, token_a_ledger_id, user_account);
    assert_eq!(user_balance_a_after_approve, total_mint_amount_a.clone() - Nat::from(TOKEN_A_FEE), "User balance for Token A after approval is incorrect");
    let kong_account_for_allowance_check = Account { owner: kong_backend, subaccount: None };
    let allowance_a_details = get_icrc2_allowance(&ic, token_a_ledger_id, user_account, kong_account_for_allowance_check);
    assert_eq!(allowance_a_details.allowance, approve_amount_a_orig);
    assert_eq!(allowance_a_details.expires_at, None, "Allowance expiry for Token A should be None");

    let approve_amount_b_orig = token_b_liquidity_amount.clone() + Nat::from(TOKEN_B_FEE_ICP);
    let approve_args_b = ApproveArgs {
        from_subaccount: None,
        spender: Account { owner: kong_backend, subaccount: None },
        amount: approve_amount_b_orig.clone(),
        expected_allowance: None,
        expires_at: None,
        fee: None,
        memo: None,
        created_at_time: None,
    };
    let approve_payload_b = encode_one(approve_args_b).expect("Failed to encode approve_args_b for Token B (ICP)");
    let approve_response_b = ic
        .update_call(token_b_ledger_id, user_principal, "icrc2_approve", approve_payload_b)
        .expect("Failed to call icrc2_approve for Token B (ICP) by user");
    let approve_result_b = decode_one::<Result<Nat, ApproveError>>(&approve_response_b)
        .expect("Failed to decode icrc2_approve response for Token B (ICP)");
    assert!(
        approve_result_b.is_ok(),
        "User approval for Token B (ICP) failed: {:?}",
        approve_result_b
    );
    let user_balance_b_after_approve = get_icrc1_balance(&ic, token_b_ledger_id, user_account);
    assert_eq!(user_balance_b_after_approve, total_mint_amount_b.clone() - Nat::from(TOKEN_B_FEE_ICP), "User balance for Token B (ICP) after approval is incorrect");
    let kong_account_for_allowance_check_b = Account { owner: kong_backend, subaccount: None };
    let allowance_b_details = get_icrc2_allowance(&ic, token_b_ledger_id, user_account, kong_account_for_allowance_check_b);
    assert_eq!(allowance_b_details.allowance, approve_amount_b_orig);
    assert_eq!(allowance_b_details.expires_at, None, "Allowance expiry for Token B (ICP) should be None");

    let kong_account = Account { owner: kong_backend, subaccount: None };
    let kong_balance_a_before_add = get_icrc1_balance(&ic, token_a_ledger_id, kong_account);
    assert_eq!(kong_balance_a_before_add, Nat::from(0_u64), "Kong backend balance for Token A should be 0 before add_pool");
    let kong_balance_b_before_add = get_icrc1_balance(&ic, token_b_ledger_id, kong_account);
    assert_eq!(kong_balance_b_before_add, Nat::from(0_u64), "Kong backend balance for Token B (ICP) should be 0 before add_pool");

    let add_pool_args = AddPoolArgs {
        token_0: token_a_str.clone(),
        amount_0: token_a_liquidity_amount.clone(),
        tx_id_0: None,
        token_1: token_b_str.clone(),
        amount_1: token_b_liquidity_amount.clone(),
        tx_id_1: None,
        lp_fee_bps: None,
    };

    let add_pool_payload = encode_one(&add_pool_args).expect("Failed to encode add_pool_args");

    let add_pool_response_bytes = ic
        .update_call(kong_backend, user_principal, "add_pool", add_pool_payload)
        .expect("Failed to call add_pool");

    let add_pool_result = decode_one::<Result<AddPoolReply, String>>(&add_pool_response_bytes)
        .expect("Failed to decode add_pool response");
    
    assert!(
        add_pool_result.is_ok(),
        "add_pool call failed: {:?}",
        add_pool_result
    );

    // --- Phase 3: Verify pool creation by calling 'pools' ---
    // Encode the argument for 'pools': opt text = None
    let pools_payload = encode_one(Option::<String>::None).expect("Failed to encode None for pools arg");

    // Call the 'pools' query function
    let pools_response_bytes = ic
        .query_call(
            kong_backend,
            user_principal, // Caller doesn't strictly matter for query
            "pools",
            pools_payload,
        )
        .expect("Failed to call pools query function");

    // Define the expected result types matching the Candid definition
    #[derive(CandidType, Deserialize, Debug, Clone)]
    struct PoolReply {
        pool_id : u32,
        name : String,
        symbol : String,
        chain_0 : String,
        symbol_0 : String,
        address_0 : String,
        balance_0 : Nat,
        lp_fee_0 : Nat,
        chain_1 : String,
        symbol_1 : String,
        address_1 : String,
        balance_1 : Nat,
        lp_fee_1 : Nat,
        price : f64,
        lp_fee_bps : u8,
        lp_token_symbol : String,
        is_removed : bool,
    }

    #[derive(CandidType, Deserialize, Debug)]
    enum PoolsResult {
        Ok(Vec<PoolReply>),
        Err(String),
    }

    // Decode the response (PocketIC query_call returns Result<Vec<u8>, UserError>)
    // The Vec<u8> itself contains the Candid encoded PoolsResult
    let pools_result_decoded = decode_one::<PoolsResult>(&pools_response_bytes)
         .expect("Failed to decode pools response");


    println!("pools_result_decoded: {:?}", pools_result_decoded);

    // Assert the inner PoolsResult is Ok and contains pools
    match pools_result_decoded {
        PoolsResult::Ok(pools) => {
            assert!(!pools.is_empty(), "Pool list should not be empty after adding a pool");
            assert_eq!(pools.len(), 1, "Expected exactly one pool");
            let pool = &pools[0];
            assert_eq!(pool.symbol_0, TOKEN_A_SYMBOL);
            assert_eq!(pool.symbol_1, TOKEN_B_SYMBOL_ICP);
        }
        PoolsResult::Err(e) => {
            panic!("Pools call returned an application error: {}", e);
        }
    }
}
