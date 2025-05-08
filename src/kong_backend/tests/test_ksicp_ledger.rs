pub mod common;

use anyhow::Result;
use candid::{decode_one, encode_one, Principal};
use ic_ledger_types::{AccountIdentifier, Subaccount};
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;

use common::icp_ledger::{create_icp_ledger, ArchiveOptions, InitArgs, LedgerArg, Tokens};
use common::identity;

const MINTING_ACCOUNT_PEM_FILE: &str = "tests/common/identity.pem";

const KSICP_SYMBOL: &str = "ksICP";
const KSICP_NAME: &str = "Internet Computer (KongSwap Test Token)";
const KSICP_FEE: u64 = 10_000;
const KSICP_DECIMALS: u8 = 8;

fn deploy_ksicp_ledger(ic: &PocketIc) -> Result<Principal> {
    let controller_identity =
        identity::get_identity_from_pem_file(MINTING_ACCOUNT_PEM_FILE).expect("Failed to get minting account identity");
    let controller_principal_id = controller_identity.sender().expect("Failed to get principal id");
    let controller_account = Account {
        owner: controller_principal_id,
        subaccount: None,
    };
    let controller_subaccount = Subaccount([0; 32]);
    let controller_account_id = AccountIdentifier::new(&controller_account.owner, &controller_subaccount);
    let init_args = InitArgs {
        minting_account: controller_account_id.to_string(),
        icrc1_minting_account: None,
        initial_values: vec![],
        max_message_size_bytes: None,
        transaction_window: None,
        send_whitelist: vec![],
        transfer_fee: Some(Tokens { e8s: KSICP_FEE }),
        token_symbol: Some(KSICP_SYMBOL.to_string()),
        token_name: Some(KSICP_NAME.to_string()),
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
    let ksicp_ledger = create_icp_ledger(ic, &Some(controller_principal_id), &ledger_arg)?;

    Ok(ksicp_ledger)
}

#[test]
fn test_ksicp_ledger_icrc1_name() {
    let ic = PocketIc::new();
    let ksicp_ledger = deploy_ksicp_ledger(&ic).expect("Failed to deploy ksicp ledger");

    let args = encode_one((ksicp_ledger,)).expect("Failed to encode arguments");
    let Ok(response) = ic.query_call(ksicp_ledger, Principal::anonymous(), "icrc1_name", args) else {
        panic!("Failed to query icrc1_name");
    };
    let result = decode_one::<String>(&response).expect("Failed to decode icrc1_name response");

    let expected_icrc1_name = KSICP_NAME.to_string();
    assert_eq!(
        result, expected_icrc1_name,
        "icrc1_name got {}, should be {}",
        result, expected_icrc1_name
    );
}
