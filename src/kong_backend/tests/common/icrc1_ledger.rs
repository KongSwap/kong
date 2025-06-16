use anyhow::Result;
use candid::{decode_one, encode_one, CandidType, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::allowance::{Allowance, AllowanceArgs};
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};
use pocket_ic::PocketIc;
use serde_bytes;
use std::fs;

use crate::common::canister::{create_canister, create_canister_with_id}; // Added create_canister_at_id

const IC_ICRC1_LEDGER_WASM: &str = "wasm/ic-icrc1-ledger.wasm.gz";

#[derive(CandidType, Clone)]
pub struct MetadataValueRecord {
    pub text: MetadataValue,
}
#[derive(CandidType, Clone)]
pub enum MetadataValue {
    Nat(Nat),
    Int(i64),
    Text(String),
    Blob(Vec<u8>),
}

#[derive(CandidType, Clone)]
pub struct FeatureFlags {
    pub icrc2: bool,
    pub icrc3: bool,
}

#[derive(CandidType, Clone, Debug)]
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

#[derive(CandidType, Clone)]
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

/// Creates an ICRC1 ledger with custom settings
pub fn create_icrc1_ledger(ic: &PocketIc, controller: &Option<Principal>, ledger_arg: &LedgerArg) -> Result<Principal> {
    let icrc1_ledger = create_canister(ic, controller, &None);
    let wasm_module = fs::read(IC_ICRC1_LEDGER_WASM)?;
    let args = encode_one(ledger_arg)?;
    ic.install_canister(icrc1_ledger, wasm_module, args, *controller);
    Ok(icrc1_ledger)
}

#[derive(Clone)]
pub struct SimpleLedgerConfig {
    pub token_symbol: String,
    pub token_name: String,
    pub initial_balances: Vec<(Account, Nat)>,
    pub transfer_fee: Nat,
    pub decimals: u8,
    pub controller: Principal,
}

impl Default for SimpleLedgerConfig {
    fn default() -> Self {
        Self {
            token_symbol: "TEST".to_string(),
            token_name: "Test Token".to_string(),
            initial_balances: vec![],
            transfer_fee: Nat::from(10_000u64),
            decimals: 8,
            controller: Principal::anonymous(),
        }
    }
}

/// Creates an ICRC1 ledger with simplified configuration and sensible defaults
pub fn create_icrc1_ledger_simple(ic: &PocketIc, config: SimpleLedgerConfig) -> Result<Principal> {
    let ledger_arg = LedgerArg::Init(InitArgs {
        minting_account: Account {
            owner: Principal::anonymous(),
            subaccount: None,
        },
        fee_collector_account: None,
        transfer_fee: config.transfer_fee,
        decimals: Some(config.decimals),
        max_memo_length: Some(256),
        token_symbol: config.token_symbol,
        token_name: config.token_name,
        metadata: vec![],
        initial_balances: config.initial_balances,
        feature_flags: Some(FeatureFlags { icrc2: true, icrc3: true }),
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 10000,
            max_transactions_per_response: Some(100),
            trigger_threshold: 5000,
            max_message_size_bytes: Some(2097152),
            cycles_for_archive_creation: Some(100_000_000_000),
            node_max_memory_size_bytes: Some(5_000_000_000),
            controller_id: config.controller,
            more_controller_ids: None,
        },
    });

    create_icrc1_ledger(ic, &Some(config.controller), &ledger_arg)
}

/// Creates an ICRC1 ledger canister with a specified ID and controller.
pub fn create_icrc1_ledger_with_id(
    ic: &PocketIc,
    canister_id: Principal,
    controller: Principal, // Controller for the new ledger
    ledger_arg: &LedgerArg,
) -> Result<Principal> {
    // Returns Result because create_canister_at_id does
    // 1. Create the canister shell with the specified ID
    let ledger_canister_id = create_canister_with_id(ic, canister_id, controller)?; // Use the new helper and propagate its error

    // 2. Read the Wasm module
    let wasm_module = fs::read(IC_ICRC1_LEDGER_WASM)?;

    // 3. Encode the init arguments
    let args = encode_one(ledger_arg)?;

    // 4. Install the Wasm onto the specified canister ID
    // ic.install_canister takes sender: Option<Principal>
    ic.install_canister(ledger_canister_id, wasm_module, args, Some(controller)); // Use controller as sender for install

    Ok(ledger_canister_id)
}

/// Gets the balance of an ICRC1 account
pub fn get_icrc1_balance(ic: &PocketIc, ledger_id: Principal, account: Account) -> Nat {
    let payload = encode_one(account).expect("Failed to encode account for balance_of");
    let response = ic
        .query_call(ledger_id, Principal::anonymous(), "icrc1_balance_of", payload)
        .expect("Failed to call icrc1_balance_of");
    decode_one::<Nat>(&response).expect("Failed to decode icrc1_balance_of response")
}

/// Checks the allowance for an ICRC2 account
pub fn get_icrc2_allowance(ic: &PocketIc, ledger_id: Principal, owner_account: Account, spender_account: Account) -> Allowance {
    let args = AllowanceArgs {
        account: owner_account,
        spender: spender_account,
    };
    let payload = encode_one(args).expect("Failed to encode allowance args");
    let response = ic
        .query_call(ledger_id, Principal::anonymous(), "icrc2_allowance", payload)
        .expect("Failed to call icrc2_allowance");
    decode_one::<Allowance>(&response).expect("Failed to decode icrc2_allowance response")
}

/// Transfers ICRC1 tokens
pub fn icrc1_transfer(
    ic: &PocketIc,
    ledger_id: Principal,
    sender: Principal,
    to: Account,
    amount: Nat,
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
) -> Result<Nat, TransferError> {
    let transfer_args = TransferArg {
        from_subaccount: None,
        to,
        amount,
        fee,
        memo: memo.map(|v| icrc_ledger_types::icrc1::transfer::Memo(serde_bytes::ByteBuf::from(v))),
        created_at_time: None,
    };
    let transfer_payload = encode_one(transfer_args).expect("Failed to encode transfer_args");
    let transfer_response = ic
        .update_call(ledger_id, sender, "icrc1_transfer", transfer_payload)
        .expect("Failed to call icrc1_transfer");
    decode_one::<Result<Nat, TransferError>>(&transfer_response).expect("Failed to decode icrc1_transfer response")
}

/// Approves an ICRC2 spender
#[allow(clippy::too_many_arguments)]
pub fn icrc2_approve(
    ic: &PocketIc,
    ledger_id: Principal,
    sender: Principal,
    spender: Account,
    amount: Nat,
    expected_allowance: Option<Nat>,
    expires_at: Option<u64>,
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
) -> Result<Nat, ApproveError> {
    let approve_args = ApproveArgs {
        from_subaccount: None,
        spender,
        amount,
        expected_allowance,
        expires_at,
        fee,
        memo: memo.map(|v| icrc_ledger_types::icrc1::transfer::Memo(serde_bytes::ByteBuf::from(v))),
        created_at_time: None,
    };
    let approve_payload = encode_one(approve_args).expect("Failed to encode approve_args");
    let approve_response = ic
        .update_call(ledger_id, sender, "icrc2_approve", approve_payload)
        .expect("Failed to call icrc2_approve");
    decode_one::<Result<Nat, ApproveError>>(&approve_response).expect("Failed to decode icrc2_approve response")
}
