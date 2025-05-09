use anyhow::{anyhow, Result};
use candid::{decode_one, encode_one, Principal};
use pocket_ic::PocketIc;

#[path = "common/mod.rs"]
mod common;
use common::icp_ledger::{ ArchiveOptions, Duration, FeatureFlags, InitArgs, LedgerArg, Tokens, create_icp_ledger_with_id };
use common::pic_ext::{ ensure_processed, pic_query };
use icrc_ledger_types::icrc1::account::Account;


/// Helper function to create a testnet ICP ledger with the exact canister ID expected by Kong
pub fn create_test_icp_ledger(
    ic: &PocketIc,
    controller: &Principal,
) -> Result<Principal> {
    // Use constants from the Kong backend for consistency
    const ICP_SYMBOL: &str = "ICP";
    const ICP_NAME: &str = "Internet Computer Protocol";
    
    // This is the exact canister ID expected by Kong for ICP in local/staging mode
    // From src/kong_backend/src/ic/icp.rs: ICP_ADDRESS
    let icp_canister_id = Principal::from_text("nppha-riaaa-aaaal-ajf2q-cai").unwrap();
    
    // Build init args for the ICP ledger using types from common::icp_ledger
    let init_args = InitArgs {
        minting_account: controller.to_text(), // Use the controller's text representation
        icrc1_minting_account: Some(Account {
            owner: *controller,
            subaccount: None,
        }),
        initial_values: Vec::new(),
        max_message_size_bytes: Some(1024 * 1024), // 1MB
        transaction_window: Some(Duration {
            secs: 24 * 60 * 60, // 24 hours
            nanos: 0,
        }),
        send_whitelist: Vec::new(),
        transfer_fee: Some(Tokens {
            e8s: 10_000, // 0.0001 ICP
        }),
        token_symbol: Some(ICP_SYMBOL.to_string()),
        token_name: Some(ICP_NAME.to_string()),
        feature_flags: Some(FeatureFlags {
            icrc2: true, // Enable ICRC2 (approvals)
        }),
        archive_options: Some(ArchiveOptions {
            num_blocks_to_archive: 2000,
            max_transactions_per_response: Some(2000),
            trigger_threshold: 1000,
            max_message_size_bytes: Some(1024 * 1024), // 1MB
            cycles_for_archive_creation: Some(10_000_000_000_000), // 10T cycles
            node_max_memory_size_bytes: Some(4 * 1024 * 1024 * 1024), // 4GB
            controller_id: *controller,
            more_controller_ids: None,
        }),
    };

    let ledger_arg = LedgerArg::Init(init_args);
    
    // Use the centralized helper to create + install at the fixed ID
    let icp_ledger = create_icp_ledger_with_id(ic, controller, icp_canister_id, &ledger_arg)?;
    ensure_processed(ic);
 
    // Verify the ledger's symbol is correct
    let args = encode_one(())?;
    let result = pic_query(ic, icp_ledger, Principal::anonymous(), "icrc1_symbol", args)?;
    let symbol: String = decode_one(&result)?;
    assert_eq!(symbol, ICP_SYMBOL, "ICP ledger has wrong symbol");
 
    println!("Successfully initialized ICP ledger with canister ID: {}", icp_ledger);
 
    Ok(icp_ledger)
}