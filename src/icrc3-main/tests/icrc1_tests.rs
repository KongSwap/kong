pub mod common;

use anyhow::Result;
use candid::{Nat, Principal, decode_one, encode_one};
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;

use common::icrc1_ledger::{ArchiveOptions, InitArgs, LedgerArg, create_icrc1_ledger};
use common::identity;

const MINTING_ACCOUNT_PEM_FILE: &str = "tests/common/identity.pem";

const TOKEN_SYMBOL: &str = "FOOBAR";
const TOKEN_NAME: &str = "Foo Bar";
const TOKEN_FEE: u64 = 10_000;
const TOKEN_DECIMALS: u8 = 8;

fn setup_ic_environment() -> Result<(PocketIc, Principal)> {
    let ic = PocketIc::new();

    // deploy the ICRC1 ledger canister
    let controller_identity = identity::get_identity_from_pem_file(MINTING_ACCOUNT_PEM_FILE)
        .expect("Failed to get minting account identity");
    let controller_principal_id = controller_identity
        .sender()
        .expect("Failed to get principal id");
    let controller_account = Account {
        owner: controller_principal_id,
        subaccount: None,
    };
    let init_args = InitArgs {
        minting_account: controller_account,
        fee_collector_account: None,
        transfer_fee: Nat::from(TOKEN_FEE),
        decimals: Some(TOKEN_DECIMALS),
        max_memo_length: Some(32),
        token_symbol: TOKEN_SYMBOL.to_string(),
        token_name: TOKEN_NAME.to_string(),
        metadata: vec![],
        initial_balances: vec![],
        feature_flags: None,
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 5_000,
            max_transactions_per_response: None,
            trigger_threshold: 10_00,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: controller_principal_id,
            more_controller_ids: None,
        },
    };
    let ledger_arg = LedgerArg::Init(init_args);
    let icrc1_ledger = create_icrc1_ledger(&ic, &Some(controller_principal_id), &ledger_arg)?;

    Ok((ic, icrc1_ledger))
}

#[test]
fn test_icrc1_symbol() {
    let (ic, icrc1_ledger) = setup_ic_environment().expect("Failed to setup IC environment");

    let Ok(response) = ic.query_call(
        icrc1_ledger,
        Principal::anonymous(),
        "icrc1_symbol",
        encode_one(()).unwrap(),
    ) else {
        panic!("Failed to query icrc1_symbol");
    };
    let result = decode_one::<String>(&response).unwrap();

    assert_eq!(result, TOKEN_SYMBOL.to_string());
}

#[test]
fn test_icrc1_name() {
    let (ic, icrc1_ledger) = setup_ic_environment().expect("Failed to setup IC environment");

    let Ok(response) = ic.query_call(
        icrc1_ledger,
        Principal::anonymous(),
        "icrc1_name",
        encode_one(()).unwrap(),
    ) else {
        panic!("Failed to query icrc1_name");
    };
    let result = decode_one::<String>(&response).unwrap();

    assert_eq!(result, TOKEN_NAME.to_string());
}

#[test]
fn test_icrc1_fee() {
    let (ic, icrc1_ledger) = setup_ic_environment().expect("Failed to setup IC environment");

    let Ok(response) = ic.query_call(
        icrc1_ledger,
        Principal::anonymous(),
        "icrc1_fee",
        encode_one(()).unwrap(),
    ) else {
        panic!("Failed to query icrc1_fee");
    };
    let result = decode_one::<Nat>(&response).unwrap();

    assert_eq!(result, Nat::from(TOKEN_FEE));
}

#[test]
fn test_icrc1_decimals() {
    let (ic, icrc1_ledger) = setup_ic_environment().expect("Failed to setup IC environment");

    let Ok(response) = ic.query_call(
        icrc1_ledger,
        Principal::anonymous(),
        "icrc1_decimals",
        encode_one(()).unwrap(),
    ) else {
        panic!("Failed to query icrc1_decimals");
    };
    let result = decode_one::<u8>(&response).unwrap();

    assert_eq!(result, TOKEN_DECIMALS);
}
