use anyhow::Result;
use candid::{decode_one, encode_one, CandidType, Principal, Deserialize, Nat};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};
use icrc_ledger_types::icrc2::allowance::{Allowance, AllowanceArgs};
use pocket_ic::PocketIc;
use std::fs;
use serde_bytes;

use crate::common::canister::{create_canister, create_canister_with_id}; // Added create_canister_with_id

// Using the ledger-canister.wasm.gz file which is the ICP ledger implementation
const ICP_LEDGER_WASM: &str = "wasm/ledger-canister.wasm.gz";

type TextAccountIdentifier = String;

#[derive(CandidType, Clone, Deserialize, Debug)]
pub struct Tokens {
    pub e8s: u64,
}

#[derive(CandidType, Clone)]
pub struct Duration {
    pub secs: u64,
    pub nanos: u32,
}

#[derive(CandidType, Clone)]
pub struct FeatureFlags {
    pub icrc2: bool,
}

#[derive(CandidType, Clone)]
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
    pub minting_account: TextAccountIdentifier,
    pub icrc1_minting_account: Option<Account>,
    pub initial_values: Vec<(TextAccountIdentifier, Tokens)>,
    pub max_message_size_bytes: Option<u64>,
    pub transaction_window: Option<Duration>,
    pub archive_options: Option<ArchiveOptions>,
    pub send_whitelist: Vec<Principal>,
    pub transfer_fee: Option<Tokens>,
    pub token_symbol: Option<String>,
    pub token_name: Option<String>,
    pub feature_flags: Option<FeatureFlags>,
}

#[derive(CandidType, Clone)]
pub struct UpgradeArgs {
    pub icrc1_minting_account: Option<Account>,
    pub feature_flags: Option<FeatureFlags>,
}

#[derive(CandidType, Clone)]
pub enum LedgerCanisterPayload {
    Init(InitArgs),
    Upgrade(Option<UpgradeArgs>),
}

#[derive(CandidType, Clone)]
pub enum LedgerArg {
    Init(InitArgs),
    Upgrade(UpgradeArgs),
}

pub fn create_icp_ledger(ic: &PocketIc, controller: &Option<Principal>, ledger_arg: &LedgerArg) -> Result<Principal> {
    let icp_ledger = create_canister(ic, controller, &None);
    let wasm_module = fs::read(ICP_LEDGER_WASM)?;
    
    // Convert to LedgerCanisterPayload as expected by the Candid definition
    let payload = match ledger_arg {
        LedgerArg::Init(init_args) => LedgerCanisterPayload::Init(init_args.clone()),
        LedgerArg::Upgrade(upgrade_args) => LedgerCanisterPayload::Upgrade(Some(upgrade_args.clone())),
    };
    
    // Encode the payload
    let args = encode_one(payload)?;
    
    ic.install_canister(icp_ledger, wasm_module, args, *controller);
    Ok(icp_ledger)
}

/// Creates an ICP ledger canister with a specified ID and controller.
/// This is analogous to `create_icrc1_ledger_with_id` but for the ICP ledger,
pub fn create_icp_ledger_with_id(
    ic: &PocketIc,
    canister_id: Principal,    // The specific ID for the ICP ledger
    controller: Principal,     // Controller for the new ledger
    ledger_arg: &LedgerArg,    // This is the ICP-specific LedgerArg from this file
) -> Result<Principal> {
    // 1. Create the canister shell with the specified ID
    let ledger_canister_id = create_canister_with_id(ic, canister_id, controller)?;

    // 2. Read the Wasm module (ICP Ledger Wasm)
    // ICP_LEDGER_WASM points to "wasm/ledger-canister.wasm.gz"
    let wasm_module = fs::read(ICP_LEDGER_WASM)?;

    // 3. Encode the init arguments (ICP specific)
    // Convert to LedgerCanisterPayload as expected by the Candid definition
    let payload = match ledger_arg {
        LedgerArg::Init(init_args) => LedgerCanisterPayload::Init(init_args.clone()),
        LedgerArg::Upgrade(upgrade_args) => LedgerCanisterPayload::Upgrade(Some(upgrade_args.clone())),
    };
    
    // Encode the payload
    let args = encode_one(payload)?;

    // 4. Install the Wasm onto the specified canister ID
    ic.install_canister(ledger_canister_id, wasm_module, args, Some(controller));

    Ok(ledger_canister_id)
}

/// Gets the balance of an ICRC1 account in ICP ledger
pub fn get_icp_balance(ic: &PocketIc, ledger_id: Principal, account: Account) -> Nat {
    let payload = encode_one(account).expect("Failed to encode account for balance_of");
    let response = ic
        .query_call(ledger_id, Principal::anonymous(), "icrc1_balance_of", payload)
        .expect("Failed to call icrc1_balance_of on ICP ledger");
    decode_one::<Nat>(&response).expect("Failed to decode icrc1_balance_of response from ICP ledger")
}

/// Checks the allowance for an ICRC2 account in ICP ledger
pub fn get_icp_allowance(
    ic: &PocketIc,
    ledger_id: Principal,
    owner_account: Account,
    spender_account: Account,
) -> Allowance {
    let args = AllowanceArgs {
        account: owner_account,
        spender: spender_account,
    };
    let payload = encode_one(args).expect("Failed to encode allowance args");
    let response = ic
        .query_call(ledger_id, Principal::anonymous(), "icrc2_allowance", payload)
        .expect("Failed to call icrc2_allowance on ICP ledger");
    decode_one::<Allowance>(&response).expect("Failed to decode icrc2_allowance response from ICP ledger")
}

/// Transfers ICRC1 tokens from ICP ledger
pub fn icp_transfer(
    ic: &PocketIc, 
    ledger_id: Principal, 
    sender: Principal, 
    to: Account, 
    amount: Nat, 
    fee: Option<Nat>, 
    memo: Option<Vec<u8>>
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
        .expect("Failed to call icrc1_transfer on ICP ledger");
    decode_one::<Result<Nat, TransferError>>(&transfer_response)
        .expect("Failed to decode icrc1_transfer response from ICP ledger")
}

/// Approves an ICRC2 spender in ICP ledger
pub fn icp_approve(
    ic: &PocketIc, 
    ledger_id: Principal, 
    sender: Principal, 
    spender: Account, 
    amount: Nat, 
    expected_allowance: Option<Nat>, 
    expires_at: Option<u64>, 
    fee: Option<Nat>,
    memo: Option<Vec<u8>>
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
        .expect("Failed to call icrc2_approve on ICP ledger");
    decode_one::<Result<Nat, ApproveError>>(&approve_response)
        .expect("Failed to decode icrc2_approve response from ICP ledger")
}
