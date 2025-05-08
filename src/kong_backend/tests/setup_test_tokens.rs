use anyhow::{anyhow, Result};
use candid::{decode_one, encode_one, Principal};
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;

#[path = "common/mod.rs"]
mod common;

// Use common module from the tests directory
use common::icrc1_ledger::{ ArchiveOptions, FeatureFlags, InitArgs, LedgerArg, create_icrc1_ledger };
use common::icrc3_ledger::create_icrc3_ledger;
use common::pic_ext::{ ensure_processed, pic_query };

/// Helper function to create a testnet ksUSDT ledger
pub fn create_ksusdt_ledger(
    ic: &PocketIc,
    controller: &Principal,
) -> Result<Principal> {
    // Use constants from the Kong backend for consistency
    const KSUSDT_SYMBOL: &str = "ksUSDT";
    const KSUSDT_NAME: &str = "Testnet USDT";
    
    // Create a standard ICRC3-enabled ledger canister with ICRC2 support
    let ksusdt_ledger = create_icrc3_ledger(
        ic, 
        controller, 
        KSUSDT_NAME, 
        KSUSDT_SYMBOL, 
        6, // USDT typically has 6 decimals
        vec![] // No initial balances
    )?;
    
    // Ensure the ledger is properly initialized
    ensure_processed(ic);
    
    // Verify the ledger's symbol is correct
    let args = encode_one(())?;
    let result = pic_query(ic, ksusdt_ledger, Principal::anonymous(), "icrc1_symbol", args)?;
    let symbol: String = decode_one(&result)?;
    assert_eq!(symbol, KSUSDT_SYMBOL, "ksUSDT ledger has wrong symbol");
    
    println!("Created ksUSDT ledger with canister ID: {}", ksusdt_ledger);
    
    Ok(ksusdt_ledger)
}

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
    
    // Create a canister with this specific ID
    // PocketIC v9 provides create_canister_with_id for testing
    match ic.create_canister_with_id(Some(*controller), None, icp_canister_id) {
        Ok(_) => {
            println!("Successfully created canister with ID: {}", icp_canister_id);
            // Add cycles to the canister
            ic.add_cycles(icp_canister_id, 10_000_000_000_000); // 10T cycles
        },
        Err(e) => {
            return Err(anyhow!("Failed to create canister with ID {}: {}", icp_canister_id, e));
        }
    }
    
    let init_args = InitArgs {
        minting_account: Account {
            owner: *controller,
            subaccount: None,
        },
        fee_collector_account: None,
        transfer_fee: candid::Nat::from(10_000u64), // 0.0001 tokens
        decimals: Some(8), // ICP has 8 decimals
        max_memo_length: Some(32),
        token_symbol: ICP_SYMBOL.to_string(),
        token_name: ICP_NAME.to_string(), 
        metadata: vec![],
        initial_balances: vec![],
        feature_flags: Some(FeatureFlags {
            icrc2: true, // Enable ICRC2 (approvals)
            // ICRC3 is enabled by default in newer ledgers
        }),
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 2000,
            max_transactions_per_response: Some(2000),
            trigger_threshold: 1000,
            max_message_size_bytes: Some(1024 * 1024), // 1MB
            cycles_for_archive_creation: Some(10_000_000_000_000), // 10T cycles
            node_max_memory_size_bytes: Some(4 * 1024 * 1024 * 1024), // 4GB
            controller_id: *controller,
            more_controller_ids: None,
        },
    };

    let ledger_arg = LedgerArg::Init(init_args);
    
    // Install the ICRC1 ledger wasm on our specific canister ID
    let wasm_path = "wasm/ic-icrc1-ledger.wasm.gz"; // Path to the wasm file
    let wasm_module = std::fs::read(wasm_path).map_err(|e| anyhow!("Failed to read wasm file: {}", e))?;
    
    // Encode arguments for installation
    let args = encode_one(&ledger_arg).map_err(|e| anyhow!("Failed to encode args: {}", e))?;
    
    // Install canister code
    ic.install_canister(icp_canister_id, wasm_module, args, Some(*controller));
    ensure_processed(ic); // Make sure the ledger is properly initialized
    
    // Verify the ledger's symbol is correct
    let args = encode_one(())?;
    let result = pic_query(ic, icp_canister_id, Principal::anonymous(), "icrc1_symbol", args)?;
    let symbol: String = decode_one(&result)?;
    assert_eq!(symbol, ICP_SYMBOL, "ICP ledger has wrong symbol");
    
    println!("Successfully initialized ICP ledger with canister ID: {}", icp_canister_id);
    
    Ok(icp_canister_id)
}