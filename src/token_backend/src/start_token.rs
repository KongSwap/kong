use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;

use crate::memory;
use crate::mining;
use crate::types::{
    StorablePrincipal, TokenInfo, InitArgs, FeatureFlags, LedgerArg, MetadataValue, ArchiveOptions,
};
use crate::require_auth; // Import the helper function from lib.rs

// Helper function to read ICRC ledger WASM
fn icrc_ledger_wasm() -> Vec<u8> {
    include_bytes!("../../kong_svelte/static/wasms/ledger/ledger.wasm").to_vec()
}

fn build_metadata(token_info: &TokenInfo) -> Vec<(String, MetadataValue)> {
    let mut metadata = vec![
        ("icrc1:name".to_string(), MetadataValue::Text(token_info.name.clone())),
        ("icrc1:symbol".to_string(), MetadataValue::Text(token_info.ticker.clone())),
        ("icrc1:decimals".to_string(), MetadataValue::Nat(Nat::from(token_info.decimals))),
        ("icrc1:fee".to_string(), MetadataValue::Nat(Nat::from(token_info.transfer_fee))),
    ];

    if let Some(ref logo) = token_info.logo {
        metadata.push(("icrc1:logo".to_string(), MetadataValue::Text(logo.clone())));
    }

    metadata
}

fn default_archive_options(controller: Principal) -> ArchiveOptions {
    ArchiveOptions {
        num_blocks_to_archive: 2000,
        max_transactions_per_response: Some(1000),
        trigger_threshold: 1000,
        max_message_size_bytes: Some(3 * 1024 * 1024), // 3MB
        cycles_for_archive_creation: Some(10_000_000_000_000), // 10T cycles
        node_max_memory_size_bytes: Some(4 * 1024 * 1024 * 1024), // 4GB
        controller_id: controller,
        more_controller_ids: None,
    }
}


// Update start_token with proper initialization
#[ic_cdk::update]
pub async fn start_token() -> Result<Principal, String> {
    let _caller = require_auth()?;
    let is_creator = memory::with_creator(|creator_opt| {
        creator_opt.as_ref().map(|p| p.0) == Some(_caller)
    });
    if !is_creator {
        return Err("Only creator can start the token".to_string());
    }
    if memory::with_ledger_id(|id_opt| id_opt.is_some()) {
        return Err("Token already started".to_string());
    }
    let token_info = memory::with_token_info(|info_opt| {
        info_opt.as_ref().cloned()
            .ok_or_else(|| "Token info not initialized".to_string())
    })?;
    let create_result = ic_cdk::api::management_canister::main::create_canister(
        ic_cdk::api::management_canister::main::CreateCanisterArgument { settings: None },
        1_000_000_000_000u128,
    ).await.map_err(|e| format!("Failed to create ledger canister: {:?}", e))?;
    let ledger_id = Principal::from(create_result.0.canister_id);
    let init_args = InitArgs {
        minting_account: Account { owner: _caller, subaccount: None },
        fee_collector_account: None,
        transfer_fee: Nat::from(token_info.transfer_fee),
        decimals: Some(token_info.decimals),
        max_memo_length: Some(32),
        token_name: token_info.name.clone(),
        token_symbol: token_info.ticker.clone(),
        metadata: build_metadata(&token_info),
        initial_balances: vec![
            (Account { owner: ic_cdk::id(), subaccount: None }, Nat::from(token_info.total_supply)),
        ],
        feature_flags: Some(FeatureFlags { icrc2: true }),
        maximum_number_of_accounts: Some(100_000),
        accounts_overflow_trim_quantity: Some(1_000),
        archive_options: token_info.archive_options.clone().unwrap_or_else(|| default_archive_options(_caller)),
    };
    let ledger_arg = LedgerArg::Init(init_args);
    let encoded_args = candid::encode_one(ledger_arg).expect("Failed to encode init args");
    let install_args = ic_cdk::api::management_canister::main::InstallCodeArgument {
        mode: ic_cdk::api::management_canister::main::CanisterInstallMode::Install,
        canister_id: ledger_id,
        wasm_module: icrc_ledger_wasm(),
        arg: encoded_args,
    };
    ic_cdk::api::management_canister::main::install_code(install_args)
        .await
        .map_err(|e| format!("Failed to install ledger code: {:?}", e))?;
    memory::with_token_info_mut(|token_info_cell| {
        let mut current_info = token_info_cell.get().clone().expect("Token info gone during start_token?");
        current_info.ledger_id = Some(ledger_id);
        token_info_cell.set(Some(current_info))
            .expect("Failed to update token info with ledger id");
    });
    memory::with_ledger_id_mut(|ledger_id_cell| {
        ledger_id_cell.set(Some(StorablePrincipal(ledger_id)))
            .expect("Failed to set ledger ID");
    });
    ic_cdk::println!("Ledger deployed successfully. Creating genesis block...");
    match mining::create_genesis_block().await {
        Ok(block) => ic_cdk::println!("Genesis block created successfully: height={}, difficulty={}", block.height, block.difficulty),
        Err(e) => ic_cdk::println!("Warning: Failed to create genesis block: {}", e),
    }
    Ok(ledger_id)
}
