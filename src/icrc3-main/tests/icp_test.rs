pub mod common;

use anyhow::Result;
use candid::{Nat, Principal, decode_one, encode_one};
use ic_ledger_types::{AccountIdentifier, Subaccount};
use icrc_ledger_types::icrc1::account::Account;
//BUG - unable to reference local crate icrc3
//use icrc3::icrc1::Icrc1SupportedStandards;
use pocket_ic::PocketIc;

use common::icp_ledger::{ArchiveOptions, InitArgs, LedgerArg, Tokens, create_icp_ledger};
use common::identity;

const MINTING_ACCOUNT_PEM_FILE: &str = "tests/common/identity.pem";

const TOKEN_SYMBOL: &str = "ICP";
const TOKEN_NAME: &str = "Internet Computer";
const TOKEN_FEE: u64 = 10_000;
const TOKEN_DECIMALS: u8 = 8;

fn setup_ic_environment() -> Result<(PocketIc, Principal)> {
    let ic = PocketIc::new();

    // deploy the ICP ledger canister
    let controller_identity = identity::get_identity_from_pem_file(MINTING_ACCOUNT_PEM_FILE)
        .expect("Failed to get minting account identity");
    let controller_principal_id = controller_identity
        .sender()
        .expect("Failed to get principal id");
    let controller_account = Account {
        owner: controller_principal_id,
        subaccount: None,
    };
    let controller_subaccount = Subaccount([0; 32]);
    let controller_account_id =
        AccountIdentifier::new(&controller_account.owner, &controller_subaccount);
    let init_args = InitArgs {
        minting_account: controller_account_id.to_string(),
        icrc1_minting_account: None,
        initial_values: vec![],
        max_message_size_bytes: None,
        transaction_window: None,
        send_whitelist: vec![],
        transfer_fee: Some(Tokens { e8s: TOKEN_FEE }),
        token_symbol: Some(TOKEN_SYMBOL.to_string()),
        token_name: Some(TOKEN_NAME.to_string()),
        feature_flags: None,
        archive_options: Some(ArchiveOptions {
            num_blocks_to_archive: 5_000,
            max_transactions_per_response: None,
            trigger_threshold: 10_00,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: controller_principal_id,
            more_controller_ids: None,
        }),
    };
    let ledger_arg = LedgerArg::Init(init_args);
    let icp_ledger = create_icp_ledger(&ic, &Some(controller_principal_id), &ledger_arg)?;

    Ok((ic, icp_ledger))
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
