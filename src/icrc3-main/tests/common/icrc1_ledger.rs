use anyhow::Result;
use candid::{CandidType, Nat, Principal, encode_one};
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;
use std::fs;

use crate::common::canister::create_canister;

const IC_ICRC1_LEDGER_WASM: &str = "wasm/ic-icrc1-ledger.wasm.gz";

#[derive(CandidType)]
pub struct MetadataValueRecord {
    pub text: MetadataValue,
}
#[derive(CandidType)]
pub enum MetadataValue {
    Nat(Nat),
    Int(i64),
    Text(String),
    Blob(Vec<u8>),
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
    pub minting_account: Account,
    pub fee_collector_account: Option<Account>,
    pub transfer_fee: Nat,
    pub decimals: Option<u8>,
    pub max_memo_length: Option<u16>,
    pub token_symbol: String,
    pub token_name: String,
    pub metadata: Vec<MetadataValueRecord>,
    pub initial_balances: Vec<(Account, Nat)>,
    pub feature_flags: Option<FeatureFlags>,
    pub archive_options: ArchiveOptions,
}

#[derive(CandidType)]
pub enum ChangeFeeCollector {
    Unset,
    SetTo(Account),
}

#[derive(CandidType)]
pub struct ChangeArchiveOptions {
    pub num_blocks_to_archive: Option<u64>,
    pub max_transactions_per_response: Option<u64>,
    pub trigger_threshold: Option<u64>,
    pub max_message_size_bytes: Option<u64>,
    pub cycles_for_archive_creation: Option<u64>,
    pub node_max_memory_size_bytes: Option<u64>,
    pub controller_id: Option<Principal>,
    pub more_controller_ids: Option<Vec<Principal>>,
}

#[derive(CandidType)]
pub struct UpgradeArgs {
    pub metadata: Option<Vec<MetadataValueRecord>>,
    pub token_symbol: Option<String>,
    pub token_name: Option<String>,
    pub transfer_fee: Option<Nat>,
    pub change_fee_collector: Option<ChangeFeeCollector>,
    pub max_memo_length: Option<u16>,
    pub feature_flags: Option<FeatureFlags>,
    pub change_archive_options: Option<ChangeArchiveOptions>,
}

#[derive(CandidType)]
pub enum LedgerArg {
    Init(InitArgs),
    Upgrade(UpgradeArgs),
}

pub fn create_icrc1_ledger(
    ic: &PocketIc,
    controller: &Option<Principal>,
    ledger_arg: &LedgerArg,
) -> Result<Principal> {
    let icrc1_ledger = create_canister(ic, controller, &None);
    let wasm_module = fs::read(IC_ICRC1_LEDGER_WASM)?;
    let args = encode_one(ledger_arg).unwrap();
    ic.install_canister(icrc1_ledger, wasm_module, args, *controller);
    Ok(icrc1_ledger)
}
