pub mod common;

use anyhow::Result;
use candid::{decode_one, encode_one, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;

use common::icrc1_ledger::{create_icrc1_ledger, ArchiveOptions, InitArgs, LedgerArg};
use common::identity;

const MINTING_ACCOUNT_PEM_FILE: &str = "tests/common/identity.pem";

const KSKONG_SYMBOL: &str = "ksKONG";
const KSKONG_NAME: &str = "KongSwap (KongSwap Test Token)";
const KSKONG_FEE: u64 = 10_000;
const KSKONG_DECIMALS: u8 = 8;

fn deploy_kskong_ledger(ic: &PocketIc) -> Result<Principal> {
    let controller_identity =
        identity::get_identity_from_pem_file(MINTING_ACCOUNT_PEM_FILE).expect("Failed to get minting account identity");
    let controller_principal_id = controller_identity.sender().expect("Failed to get principal id");
    let controller_account = Account {
        owner: controller_principal_id,
        subaccount: None,
    };
    let init_args = InitArgs {
        minting_account: controller_account,
        fee_collector_account: None,
        transfer_fee: Nat::from(KSKONG_FEE),
        decimals: Some(KSKONG_DECIMALS),
        max_memo_length: Some(32),
        token_symbol: KSKONG_SYMBOL.to_string(),
        token_name: KSKONG_NAME.to_string(),
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
    let kskong_ledger = create_icrc1_ledger(ic, &Some(controller_principal_id), &ledger_arg)?;

    Ok(kskong_ledger)
}

#[test]
fn test_kskong_ledger_icrc1_name() {
    let ic = PocketIc::new();
    let ksicp_ledger = deploy_kskong_ledger(&ic).expect("Failed to deploy ksicp ledger");

    let args = encode_one((ksicp_ledger,)).expect("Failed to encode arguments");
    let Ok(response) = ic.query_call(ksicp_ledger, Principal::anonymous(), "icrc1_name", args) else {
        panic!("Failed to query icrc1_name");
    };
    let result = decode_one::<String>(&response).expect("Failed to decode icrc1_name response");

    let expected_icrc1_name = KSKONG_NAME.to_string();
    assert_eq!(
        result, expected_icrc1_name,
        "icrc1_name got {}, should be {}",
        result, expected_icrc1_name
    );
}
