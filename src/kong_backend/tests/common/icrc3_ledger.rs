use anyhow::{anyhow, Result};
use candid::{CandidType, Deserialize, encode_one, decode_one, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use num_traits::ToPrimitive;
use pocket_ic::PocketIc;

use crate::common::icrc1_ledger::{
    create_icrc1_ledger, ArchiveOptions, FeatureFlags, InitArgs, LedgerArg,
};
use crate::common::pic_ext::{pic_query, ensure_processed};

/// ICRC3 Transfer structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Transfer {
    pub to: Account,
    pub fee: Option<Nat>,
    pub from: Account,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
    pub amount: Nat,
    pub spender: Option<Account>,
}

/// ICRC3 Mint structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Mint {
    pub to: Account,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
    pub amount: Nat,
}

/// ICRC3 Burn structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Burn {
    pub from: Account,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
    pub amount: Nat,
    pub spender: Option<Account>,
}

/// ICRC3 Approve structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Approve {
    pub fee: Option<Nat>,
    pub from: Account,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
    pub amount: Nat,
    pub expected_allowance: Option<Nat>,
    pub expires_at: Option<u64>,
    pub spender: Account,
}

/// ICRC3 Transaction structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Transaction {
    pub kind: String,
    pub timestamp: u64,
    pub transfer: Option<Transfer>,
    pub mint: Option<Mint>,
    pub burn: Option<Burn>,
    pub approve: Option<Approve>
}

/// ICRC3 GetTransactionsRequest structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GetTransactionsRequest {
    pub start: Nat,
    pub length: Nat,
}

/// ICRC3 GetTransactionsResponse structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GetTransactionsResponse {
    pub log_length: Nat,
    pub first_index: Nat,
    pub transactions: Vec<Transaction>,
    pub archived_transactions: Vec<ArchivedTransaction>,
}

/// ICRC3 ArchivedTransaction structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ArchivedTransaction {
    pub start: Nat,
    pub length: Nat,
    pub callback: QueryArchiveFn,
}

/// ICRC3 GetArchiveContentsArgs structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GetArchiveContentsArgs {
    pub start: Nat,
    pub length: Nat,
}

/// ICRC3 QueryArchiveFn structure
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct QueryArchiveFn {
    pub canister_id: Principal,
    pub method: String,
    pub args: GetArchiveContentsArgs,
}

/// Create an ICRC3-enabled ledger canister
/// 
/// This function creates an ICRC1 ledger with ICRC3 features enabled
/// (ICRC3 is enabled by default in newer ledger versions)
pub fn create_icrc3_ledger(
    ic: &PocketIc,
    controller: &Principal,
    token_name: &str,
    token_symbol: &str,
    decimals: u8,
    initial_balances: Vec<(Account, Nat)>,
) -> Result<Principal> {
    let init_args = InitArgs {
        minting_account: Account {
            owner: *controller,
            subaccount: None,
        },
        fee_collector_account: None,
        transfer_fee: Nat::from(10_000u64), // 0.0001 tokens
        decimals: Some(decimals),
        max_memo_length: Some(32),
        token_symbol: token_symbol.to_string(),
        token_name: token_name.to_string(),
        metadata: vec![],
        initial_balances,
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
    let ledger = create_icrc1_ledger(ic, &Some(*controller), &ledger_arg)?;
    ensure_processed(ic); // Make sure the ledger is properly initialized
    Ok(ledger)
}

/// Get transaction using ICRC3 get_transactions method
pub fn get_transaction(
    ic: &PocketIc,
    token_ledger: Principal,
    block_id: &Nat,
) -> Result<Option<Transaction>> {
    // Create GetTransactionsRequest for a single transaction
    let request = GetTransactionsRequest {
        start: block_id.clone(),
        length: Nat::from(1u64),
    };

    // Encode the single request argument directly
    let args = encode_one(request)?;

    // Call the get_transactions method on the ledger
    let result = pic_query(
        ic,
        token_ledger,
        Principal::anonymous(),
        "get_transactions",
        args,
    )?;

    // Decode the response
    let response: GetTransactionsResponse = decode_one(&result)?;

    // Return the transaction if found
    if !response.transactions.is_empty() {
        Ok(Some(response.transactions[0].clone()))
    } else {
        // Check if it's in archived transactions
        for archive in response.archived_transactions {
            if *block_id >= archive.start && *block_id < (archive.start.clone() + archive.length.clone()) {
                // Need to query the archive
                let archive_result = pic_query(
                    ic,
                    archive.callback.canister_id,
                    Principal::anonymous(),
                    &archive.callback.method,
                    encode_one(&archive.callback.args)?,
                )?;

                let archive_response: GetTransactionsResponse = decode_one(&archive_result)?;
                if !archive_response.transactions.is_empty() {
                    let diff = block_id.clone() - archive.start.clone();
                    let relative_index = diff.0.to_u64()
                        .ok_or_else(|| anyhow!("Block index difference too large"))?;
                    if relative_index < archive_response.transactions.len() as u64 {
                        return Ok(Some(archive_response.transactions[relative_index as usize].clone()));
                    }
                }
            }
        }
        Ok(None)
    }
}

/// Get transactions in a range using ICRC3 get_transactions method
pub fn get_transactions(
    ic: &PocketIc,
    token_ledger: Principal,
    start: &Nat,
    length: u64,
) -> Result<GetTransactionsResponse> {
    // Create GetTransactionsRequest
    let request = GetTransactionsRequest {
        start: start.clone(),
        length: Nat::from(length),
    };

    // Encode the single request argument directly
    let args = encode_one(request)?;

    // Call the get_transactions method on the ledger
    let result = pic_query(
        ic,
        token_ledger,
        Principal::anonymous(),
        "get_transactions",
        args,
    )?;

    // Decode the response
    let response: GetTransactionsResponse = decode_one(&result)?;
    Ok(response)
}

/// Verify ICRC3 transfer against expected parameters
pub fn verify_icrc3_transfer(
    ic: &PocketIc,
    token_ledger: Principal,
    block_id: &Nat,
    from: &Account,
    to: &Account,
    amount: &Nat,
) -> Result<bool> {
    // Get the transaction
    let transaction = get_transaction(ic, token_ledger, block_id)?
        .ok_or_else(|| anyhow!("Transaction not found"))?;

    // Verify transaction details
    if let Some(transfer) = transaction.transfer {
        let transfer_matches = 
            transaction.kind == "transfer" &&
            transfer.from == *from &&
            transfer.to == *to &&
            transfer.amount == *amount;
        
        Ok(transfer_matches)
    } else {
        // Transaction exists but is not a transfer operation
        Ok(false)
    }
}

/// Get total transaction count (log_length) from the ledger
pub fn get_transaction_count(
    ic: &PocketIc,
    token_ledger: Principal,
) -> Result<Nat> {
    // Create a minimal request to get log length
    let request = GetTransactionsRequest {
        start: Nat::from(0u64),
        length: Nat::from(0u64),
    };

    // Encode the single request argument directly
    let args = encode_one(request)?;

    // Call the get_transactions method on the ledger
    let result = pic_query(
        ic,
        token_ledger,
        Principal::anonymous(),
        "get_transactions",
        args,
    )?;

    // Decode the response
    let response: GetTransactionsResponse = decode_one(&result)?;
    Ok(response.log_length)
}