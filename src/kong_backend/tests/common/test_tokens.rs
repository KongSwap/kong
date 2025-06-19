use anyhow::Result;
use candid::{decode_one, encode_one, Nat, Principal};
use ic_ledger_types::{AccountIdentifier, Subaccount};
use icrc_ledger_types::icrc1::account::Account;

use super::icrc1_ledger::{create_icrc1_ledger_with_id, ArchiveOptions as ICRC1ArchiveOptions, FeatureFlags as ICRC1FeatureFlags, InitArgs as ICRC1InitArgs, LedgerArg as ICRC1LedgerArg};
use super::icp_ledger::{
    create_icp_ledger_with_id, ArchiveOptions as ICPArchiveOptions, InitArgs as ICPInitArgs,
    LedgerArg as ICPLedgerArg, Tokens,
};
use kong_backend::add_token::add_token_args::AddTokenArgs;
use kong_backend::add_token::add_token_reply::AddTokenReply;

pub fn initialize_default_tokens(
    ic: &pocket_ic::PocketIc,
    kong_backend: Principal,
    controller_principal: Principal,
) -> Result<(Principal, Principal)> {
    let controller_account = Account {
        owner: controller_principal,
        subaccount: None,
    };

    // --- ckUSDT (ICRC1) ---
    let ckusdt_id = Principal::from_text("zdzgz-siaaa-aaaar-qaiba-cai")?;
    let archive_options_icrc1 = ICRC1ArchiveOptions {
        num_blocks_to_archive: 1000,
        max_transactions_per_response: None,
        trigger_threshold: 500,
        max_message_size_bytes: None,
        cycles_for_archive_creation: None,
        node_max_memory_size_bytes: None,
        controller_id: controller_principal,
        more_controller_ids: None,
    };
    let ckusdt_init = ICRC1InitArgs {
        minting_account: controller_account,
        fee_collector_account: None,
        transfer_fee: Nat::from(10_000u64),
        decimals: Some(8),
        max_memo_length: Some(32),
        token_symbol: "ckUSDT".to_string(),
        token_name: "ckUSDT Test Token".to_string(),
        metadata: vec![],
        initial_balances: vec![],
        feature_flags: Some(ICRC1FeatureFlags { icrc2: true, icrc3: true }),
        archive_options: archive_options_icrc1.clone(),
    };
    let ckusdt_ledger_id = create_icrc1_ledger_with_id(
        ic,
        ckusdt_id,
        controller_principal,
        &ICRC1LedgerArg::Init(ckusdt_init),
    )?;

    // --- ICP (uses ICP ledger) ---
    let icp_id = Principal::from_text("nppha-riaaa-aaaal-ajf2q-cai")?;
    let controller_account_identifier = AccountIdentifier::new(&controller_principal, &Subaccount([0;32]));
    let icp_init = ICPInitArgs {
        minting_account: controller_account_identifier.to_string(),
        icrc1_minting_account: None,
        initial_values: vec![],
        max_message_size_bytes: None,
        transaction_window: None,
        archive_options: Some(ICPArchiveOptions {
            num_blocks_to_archive: 1000,
            max_transactions_per_response: None,
            trigger_threshold: 500,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: controller_principal,
            more_controller_ids: None,
        }),
        send_whitelist: vec![],
        transfer_fee: Some(Tokens { e8s: 10_000 }),
        token_symbol: Some("ICP".to_string()),
        token_name: Some("Internet Computer Protocol".to_string()),
        feature_flags: Some(super::icp_ledger::FeatureFlags { icrc2: true }),
    };
    let icp_ledger_id = create_icp_ledger_with_id(
        ic,
        icp_id,
        controller_principal,
        &ICPLedgerArg::Init(icp_init),
    )?;

    // --- Add tokens to Kong backend ---
    for ledger_id in [ckusdt_ledger_id, icp_ledger_id] {
        let token = format!("IC.{}", ledger_id.to_text());
        let args = encode_one(&AddTokenArgs { token, ..Default::default() }).expect("encode add_token");
        let response = ic
            .update_call(kong_backend, controller_principal, "add_token", args)
            .map_err(|e| anyhow::anyhow!("call add_token failed: {:?}", e))?;
        let result: Result<AddTokenReply, String> = decode_one(&response)?;
        result.map_err(|e| anyhow::anyhow!("add_token failed: {}", e))?;
    }

    Ok((ckusdt_ledger_id, icp_ledger_id))
}