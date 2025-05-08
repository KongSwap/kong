use anyhow::Result;
use candid::{CandidType, Principal, encode_one};
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;
use std::fs;

use crate::common::canister::create_canister;

const IC_ICRC1_LEDGER_WASM: &str = "wasm/ledger-canister.wasm.gz";

type TextAccountIdentifier = String;

#[derive(CandidType)]
pub struct Tokens {
    pub e8s: u64,
}

#[derive(CandidType)]
pub struct Duration {
    pub secs: u64,
    pub nanos: u32,
}

#[derive(CandidType)]
pub struct FeatureFlags {
    pub icrc2: bool,
}

#[derive(CandidType)]
pub struct ArchiveOptions {
    pub num_blocks_to_archive: u64,
    pub max_transactions_per_response: Option<u64>,
    pub trigger_threshold: u64,
    pub max_message_size_bytes: Option<u64>,
    pub cycles_for_archive_creation: Option<u64>,
    pub node_max_memory_size_bytes: Option<u64>,
    pub controller_id: Principal,
    pub more_controller_ids: Option<Vec<Principal>>,
}

#[derive(CandidType)]
pub struct InitArgs {
    pub minting_account: TextAccountIdentifier,
    pub icrc1_minting_account: Option<Account>,
    pub initial_values: Vec<(TextAccountIdentifier, Tokens)>,
    pub max_message_size_bytes: Option<u64>,
    pub transaction_window: Option<Duration>,
    pub send_whitelist: Vec<Principal>,
    pub transfer_fee: Option<Tokens>,
    pub token_symbol: Option<String>,
    pub token_name: Option<String>,
    pub feature_flags: Option<FeatureFlags>,
    pub archive_options: Option<ArchiveOptions>,
}

#[derive(CandidType)]
pub struct UpgradeArgs {
    pub icrc1_minting_account: Option<Account>,
    pub feature_flags: Option<FeatureFlags>,
}

#[derive(CandidType)]
pub enum LedgerArg {
    Init(InitArgs),
    Upgrade(UpgradeArgs),
}

pub fn create_icp_ledger(
    ic: &PocketIc,
    controller: &Option<Principal>,
    ledger_arg: &LedgerArg,
) -> Result<Principal> {
    let icp_ledger = create_canister(ic, controller, &None);
    let wasm_module = fs::read(IC_ICRC1_LEDGER_WASM)?;
    let args = encode_one(ledger_arg).unwrap();
    ic.install_canister(icp_ledger, wasm_module, args, *controller);
    Ok(icp_ledger)
}
