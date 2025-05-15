use candid::{Nat, Principal};
use ic_ledger_types::{query_blocks, AccountIdentifier, Block, GetBlocksArgs, Operation, Subaccount, Tokens};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::allowance::{Allowance, AllowanceArgs};
use icrc_ledger_types::icrc3::transactions::{GetTransactionsRequest, GetTransactionsResponse};
use icrc_ledger_types::icrc3::blocks::{GetBlocksRequest as ICRC3GetBlocksRequest, GetBlocksResult as ICRC3GetBlocksResult};
use icrc_ledger_types::icrc::generic_value::ICRC3Value;
use std::collections::BTreeMap;
use serde::{Deserialize, Serialize};
use candid::CandidType;

use super::wumbo::Transaction1;

use crate::helpers::nat_helpers::nat_to_u64;
use crate::ic::get_time::get_time;
use crate::ic::id::{caller_account_id, caller_id};
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use num_traits::cast::ToPrimitive;

#[cfg(not(feature = "prod"))]
const ICP_CANISTER_ID: &str = "IC.nppha-riaaa-aaaal-ajf2q-cai"; // Testnet ICP Ledger
#[cfg(feature = "prod")]
const ICP_CANISTER_ID: &str = "IC.ryjl3-tyaaa-aaaaa-aaaba-cai"; // Mainnet ICP Ledger
const WUMBO_CANISTER_ID: &str = "IC.wkv3f-iiaaa-aaaap-ag73a-cai";
const DAMONIC_CANISTER_ID: &str = "IC.zzsnb-aaaaa-aaaap-ag66q-cai";
const CLOWN_CANISTER_ID: &str = "IC.iwv6l-6iaaa-aaaal-ajjjq-cai";
const TAGGR_CANISTER_ID: &str = "IC.6qfxa-ryaaa-aaaai-qbhsq-cai";
const SUBACCOUNT_LENGTH: usize = 32; // 32 bytes for subaccount

// TAGGR specific GetBlocksArgs uses nat64 (u64) for both start and length.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct TaggrGetBlocksArgs {
    pub start: u64,
    pub length: u64,
}

// Decodes an ICRC3 account value from an array of ICRC3Values
fn try_decode_icrc3_account_value(icrc3_value_arr: &[ICRC3Value]) -> Option<Account> {
    // Handle Candid encoding (e.g., SNS ledgers)
    if let Some(ICRC3Value::Blob(blob)) = icrc3_value_arr.first() {
        if let Ok(owner) = Principal::try_from_slice(blob) {
            let subaccount = if icrc3_value_arr.len() >= 2 {
                if let Some(ICRC3Value::Blob(blob)) = icrc3_value_arr.get(1) {
                    if blob.len() == SUBACCOUNT_LENGTH {
                        blob.as_slice().try_into().ok()
                    } else {
                        None // Invalid length for subaccount
                    }
                } else {
                    None // Expected blob for subaccount, found something else
                }
            } else {
                None // No subaccount provided
            };

            return Some(Account { owner, subaccount });
        }
    }

    // Handle CBOR encoding (e.g., TAGGR ledger)
    if icrc3_value_arr.len() == 1 {
        if let Some(ICRC3Value::Blob(blob)) = icrc3_value_arr.first() {
            if let Ok(map) = ciborium::de::from_reader::<BTreeMap<String, ciborium::value::Value>, _>(
                blob.as_slice(),
            ) {
                let owner_bytes = match map.get("owner") {
                    Some(ciborium::value::Value::Bytes(bytes)) => bytes.as_slice(),
                    _ => return None, // Missing or invalid owner
                };
                let owner = match Principal::try_from_slice(owner_bytes) {
                    Ok(p) => p,
                    Err(_) => return None, // Invalid principal bytes
                };
                let subaccount = match map.get("subaccount") {
                    Some(ciborium::value::Value::Bytes(bytes))
                        if !bytes.is_empty() && bytes.len() == SUBACCOUNT_LENGTH =>
                    {
                        // Explicitly create array and copy slice
                        let mut subacct = [0u8; SUBACCOUNT_LENGTH];
                        subacct.copy_from_slice(bytes);
                        Some(subacct)
                    }
                    // Handles cases: missing "subaccount", not bytes, empty, wrong length
                    _ => None,
                };

                return Some(Account { owner, subaccount });
            }
        }
    }

    // If neither format matched or decoding failed at any step
    None
}

/// Represents the type of a transaction being verified.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum TransactionType {
    Approve,
    Transfer,
    TransferFrom,
}

/// Verifies a transfer by checking the ledger.
/// For ICRC3 tokens, it tries ICRC3 methods first, falling back to traditional methods.
/// For non-ICRC3 tokens, it uses the traditional verification methods.
pub async fn verify_transfer(token: &StableToken, block_id: &Nat, amount: &Nat) -> Result<(), String> {
    match token {
        StableToken::IC(ic_token) => {
            // Set up common variables used in all verification paths
            let principal = *token.canister_id().ok_or("Invalid principal id")?;
            let token_address_chain = token.address_with_chain();
            let kong_settings = kong_settings_map::get();
            let min_valid_timestamp = get_time() - kong_settings.transfer_expiry_nanosecs;
            let current_caller_account = caller_id();
            let kong_backend_account = &kong_settings.kong_backend;
            
            // For ICRC3 tokens, first try ICRC3 verification
            if ic_token.icrc3 {
                // Prepare request arguments based on token type
                let blocks_result = if token_address_chain == TAGGR_CANISTER_ID {
                    // TAGGR uses a different format
                    if let Some(start_u64) = nat_to_u64(block_id) {
                        let args = vec![TaggrGetBlocksArgs { start: start_u64, length: 1 }];
                        ic_cdk::call::<_, (ICRC3GetBlocksResult,)>(principal, "icrc3_get_blocks", (args,)).await
                    } else {
                        // Can't convert block_id to u64, skip ICRC3 verification
                        Err((ic_cdk::api::call::RejectionCode::CanisterError, "Invalid block_id format for TAGGR".to_string()))
                    }
                } else {
                    // Standard ICRC3 format
                    let args = ICRC3GetBlocksRequest { start: block_id.clone(), length: Nat::from(1u32) };
                    ic_cdk::call::<_, (ICRC3GetBlocksResult,)>(principal, "icrc3_get_blocks", (args,)).await
                };
                
                // Process blocks result if successful
                if let Ok(response_tuple) = blocks_result {
                    let blocks_data = response_tuple.0;
                    
                    for block_envelope in blocks_data.blocks.iter() {
                        // Skip blocks that don't match our ID
                        if block_envelope.id != *block_id {
                            continue;
                        }
                        
                        // Only process map-type blocks
                        let fields = match &block_envelope.block {
                            ICRC3Value::Map(fields) => fields,
                            _ => continue,
                        };
                        
                        // Extract timestamp
                        let timestamp = match fields.get("ts").and_then(|v| match v {
                            ICRC3Value::Nat(ts_nat) => ts_nat.0.to_u64(),
                            _ => None,
                        }) {
                            Some(ts) => ts,
                            None => continue, // Missing timestamp
                        };
                        
                        // Extract fields from the transaction
                        let mut op = None;
                        let mut tx_amount = None;
                        
                        // Check for block type
                        if let Some(ICRC3Value::Text(btype)) = fields.get("btype") {
                            op = Some(btype.clone());
                        }
                        
                        // Extract transaction details from tx map or top level
                        if let Some(ICRC3Value::Map(tx)) = fields.get("tx") {
                            // tx.op overrides btype
                            if let Some(ICRC3Value::Text(tx_op)) = tx.get("op") {
                                op = Some(tx_op.clone());
                            }
                            
                            // Amount
                            if let Some(ICRC3Value::Nat(amt)) = tx.get("amt") {
                                tx_amount = Some(amt.clone());
                            }
                        } else {
                            // Top level fields (TAGGR style)
                            if let Some(ICRC3Value::Nat(amt)) = fields.get("amt") {
                                tx_amount = Some(amt.clone());
                            }
                        }
                        
                        // Extract account data (either from tx map or top level)
                        let from = if let Some(ICRC3Value::Map(tx)) = fields.get("tx") {
                            tx.get("from").and_then(|v| if let ICRC3Value::Array(arr) = v {
                                try_decode_icrc3_account_value(arr)
                            } else { None })
                        } else {
                            fields.get("from").and_then(|v| if let ICRC3Value::Array(arr) = v {
                                try_decode_icrc3_account_value(arr)
                            } else { None })
                        };
                        
                        let to = if let Some(ICRC3Value::Map(tx)) = fields.get("tx") {
                            tx.get("to").and_then(|v| if let ICRC3Value::Array(arr) = v {
                                try_decode_icrc3_account_value(arr)
                            } else { None })
                        } else {
                            fields.get("to").and_then(|v| if let ICRC3Value::Array(arr) = v {
                                try_decode_icrc3_account_value(arr)
                            } else { None })
                        };
                        
                        let spender = if let Some(ICRC3Value::Map(tx)) = fields.get("tx") {
                            tx.get("spender").and_then(|v| if let ICRC3Value::Array(arr) = v {
                                try_decode_icrc3_account_value(arr)
                            } else { None })
                        } else {
                            fields.get("spender").and_then(|v| if let ICRC3Value::Array(arr) = v {
                                try_decode_icrc3_account_value(arr)
                            } else { None })
                        };
                        
                        // Verify transfer details if we have all required fields
                        if let (Some(op_str), Some(amt), Some(tx_from), Some(tx_to)) = (&op, &tx_amount, &from, &to) {
                            // Skip non-transfer operations
                            if !matches!(op_str.as_str(), "icrc1_transfer" | "1xfer" | "transfer" | "xfer") {
                                continue;
                            }
                            
                            // For a matching block, immediately return errors instead of falling through
                            if tx_from != &current_caller_account {
                                return Err("Transfer from does not match caller".to_string());
                            }
                            if tx_to != kong_backend_account {
                                return Err("Transfer to does not match Kong backend".to_string());
                            }
                            if spender.is_some() {
                                return Err("Invalid transfer spender".to_string());
                            }
                            if amt != amount {
                                return Err(format!("Invalid transfer amount: rec {:?} exp {:?}", amt, amount));
                            }
                            if timestamp < min_valid_timestamp {
                                return Err("Expired transfer timestamp".to_string());
                            }
                            
                            // All checks passed - verification successful
                            return Ok(());
                        }
                    }
                }
                // ICRC3 verification failed, only fall through to traditional methods if we couldn't find the block or format was unexpected
            }

            // If not ICRC3, or if ICRC-3 verification doesn't succeed, fall back to the traditional methods
            // Use min_valid_timestamp that was already defined above
            let ts_start = min_valid_timestamp;

            if token_address_chain == ICP_CANISTER_ID {
                // use query_blocks
                let block_args = GetBlocksArgs {
                    start: nat_to_u64(block_id).ok_or_else(|| format!("ICP ledger block id {:?} not found", block_id))?,
                    length: 1,
                };
                match query_blocks(principal, block_args).await {
                    Ok(query_response) => {
                        let blocks: Vec<Block> = query_response.blocks;
                        let backend_account_id =
                            AccountIdentifier::new(&kong_backend_account.owner, &Subaccount(kong_backend_account.subaccount.unwrap_or([0; 32])));
                        let amount = Tokens::from_e8s(nat_to_u64(amount).ok_or("Invalid ICP amount")?);
                        for block in blocks.into_iter() {
                            match block.transaction.operation {
                                Some(operation) => match operation {
                                    Operation::Transfer {
                                        from,
                                        to,
                                        amount: transfer_amount,
                                        ..
                                    } => {
                                        // ICP ledger seems to combine transfer and transfer_from
                                        if from != caller_account_id() {
                                            Err("Transfer from does not match caller")?
                                        }
                                        if to != backend_account_id {
                                            Err("Transfer to does not match Kong backend")?
                                        }
                                        if transfer_amount != amount {
                                            Err(format!("Invalid transfer amount: rec {:?} exp {:?}", transfer_amount, amount))?
                                        }
                                        if block.transaction.created_at_time.timestamp_nanos < ts_start {
                                            Err("Expired transfer timestamp")?
                                        }
                                        return Ok(());
                                    }
                                    Operation::Mint { .. } => (),
                                    Operation::Burn { .. } => (),
                                    Operation::Approve { .. } => (),
                                    Operation::TransferFrom { .. } => (), // not supported by ICP ledger
                                },
                                None => Err("No transactions in block")?,
                            }
                        }

                        Err(format!("Failed to verify {} transfer block id {}", token.symbol(), block_id))
                    }
                    Err(e) => Err(e.1),
                }
            } else if token_address_chain == WUMBO_CANISTER_ID
                || token_address_chain == DAMONIC_CANISTER_ID
                || token_address_chain == CLOWN_CANISTER_ID
            {
                // use get_transaction()
                match ic_cdk::call::<(Nat,), (Option<Transaction1>,)>(
                    principal,
                    "get_transaction",
                    (block_id.clone(),),
                )
                .await
                {
                    Ok(transaction_response) => {
                        match transaction_response.0 {
                            Some(transaction) => {
                                if let Some(transfer) = transaction.transfer {
                                    let from = transfer.from;
                                    if from != current_caller_account {
                                        Err("Transfer from does not match caller")?
                                    }
                                    let to = transfer.to;
                                    if to != *kong_backend_account {
                                        Err("Transfer to does not match Kong backend")?
                                    }
                                    let transfer_amount = transfer.amount;
                                    if transfer_amount != *amount {
                                        Err(format!("Invalid transfer amount: rec {:?} exp {:?}", transfer_amount, amount))?
                                    }
                                    let timestamp = transaction.timestamp;
                                    if timestamp < ts_start {
                                        Err("Expired transfer timestamp")?
                                    }
                                    return Ok(()); // success
                                } else if let Some(_burn) = transaction.burn {
                                    Err("Invalid burn transaction")?
                                } else if let Some(_mint) = transaction.mint {
                                    Err("Invalid mint transaction")?
                                } else {
                                    Err(format!("Invalid transaction kind: {}", transaction.kind))?
                                }
                            }
                            None => Err("No transaction found")?,
                        }
                    }
                    Err(e) => Err(e.1),
                }
            } else {
                // use get_transactions()
                let block_args = GetTransactionsRequest {
                    start: block_id.clone(),
                    length: Nat::from(1_u32),
                };
                match ic_cdk::call::<(GetTransactionsRequest,), (GetTransactionsResponse,)>(
                    principal,
                    "get_transactions",
                    (block_args,),
                )
                .await
                {
                    Ok(get_transactions_response) => {
                        let transactions = get_transactions_response.0.transactions;
                        for transaction in transactions.into_iter() {
                            if let Some(transfer) = transaction.transfer {
                                let from = transfer.from;
                                if from != current_caller_account {
                                    Err("Transfer from does not match caller")?
                                }
                                let to = transfer.to;
                                if to != *kong_backend_account {
                                    Err("Transfer to does not match Kong backend")?
                                }
                                // make sure spender is None so not an icrc2_transfer_from transaction
                                let spender = transfer.spender;
                                if spender.is_some() {
                                    Err("Invalid transfer spender")?
                                }
                                let transfer_amount = transfer.amount;
                                if transfer_amount != *amount {
                                    Err(format!("Invalid transfer amount: rec {:?} exp {:?}", transfer_amount, amount))?
                                }
                                let timestamp = transaction.timestamp;
                                if timestamp < ts_start {
                                    Err("Expired transfer timestamp")?
                                }
                                return Ok(()); // success
                            } else if let Some(_burn) = transaction.burn {
                                // not used
                            } else if let Some(_mint) = transaction.mint {
                                // not used
                            } else if let Some(_approve) = transaction.approve {
                                // not used
                            } else {
                                Err(format!("Invalid transaction kind: {}", transaction.kind))?
                            }
                        }

                        Err(format!("Failed to verify {} transfer block id {}", token.symbol(), block_id))
                    }
                    Err(e) => Err(e.1),
                }
            }
        }
        _ => Err("Verify transfer not supported for this token")?,
    }
}

/// Verifies a transaction by checking the ledger.
/// `block_id`'s meaning (block index, transaction index) depends on the ledger type.
#[allow(dead_code)]
pub async fn verify_block_id(
    token: &StableToken,
    block_id: &Nat,
    amount: &Nat,
    transaction_type: &TransactionType,
    ts: Option<u64>, // if icrc2_approve has an expiry timestamp
) -> Result<(), String> {
    match token {
        StableToken::IC(ic_token) => {
            if ic_token.icrc3 {
                // use ICRC3 get_transactions
                let block_args = GetTransactionsRequest {
                    start: block_id.clone(),
                    length: Nat::from(1_u32),
                };
                match ic_cdk::call::<(GetTransactionsRequest,), (GetTransactionsResponse,)>(
                    *token.canister_id().ok_or("Invalid principal id")?,
                    "get_transactions",
                    (block_args,),
                )
                .await
                {
                    Ok(get_transactions_response) => {
                        let transactions = get_transactions_response.0.transactions;
                        for transaction in transactions.into_iter() {
                            if let Some(_mint) = transaction.mint {
                                // not used
                            } else if let Some(_burn) = transaction.burn {
                                // not used
                            } else if let Some(transfer) = transaction.transfer {
                                if *transaction_type == TransactionType::Transfer || *transaction_type == TransactionType::TransferFrom {
                                    let from = transfer.from;
                                    let to = transfer.to;
                                    let spender = transfer.spender;
                                    let transfer_amount = transfer.amount;
                                    if from != caller_id() {
                                        Err("Transfer from does not match caller")?
                                    }
                                    if to != kong_settings_map::get().kong_backend {
                                        Err("Transfer to does not match Kong backend")?
                                    }
                                    if *transaction_type == TransactionType::TransferFrom {
                                        if let Some(spender) = spender {
                                            if spender != kong_settings_map::get().kong_backend {
                                                Err("Transfer spender does not match Kong backend")?
                                            }
                                        } else {
                                            Err("Missing transfer from spender")?
                                        }
                                    }
                                    if transfer_amount != *amount {
                                        Err(format!("Invalid transfer amount: rec {:?} exp {:?}", transfer_amount, amount))?
                                    }
                                    return Ok(()); // success
                                }
                            } else if let Some(approve) = transaction.approve {
                                if *transaction_type == TransactionType::Approve {
                                    let from = approve.from;
                                    let spender = approve.spender;
                                    let approve_amount = approve.amount;
                                    let expires_at = approve.expires_at;
                                    if from != caller_id() {
                                        Err("Approve from does not match caller")?
                                    }
                                    if spender != kong_settings_map::get().kong_backend {
                                        Err("Approve spender does not match Kong backend")?
                                    }
                                    if approve_amount < *amount {
                                        Err(format!("Insufficient approve {:?} required < {:?} amount", approve_amount, amount))?
                                    }
                                    if let Some(expires_at) = expires_at {
                                        if let Some(ts) = ts {
                                            if expires_at < ts {
                                                Err("Expired approve timestamp")?
                                            }
                                        } else {
                                            Err("Missing approve expiry timestamp")?
                                        }
                                    }
                                    return Ok(());
                                }
                            } else {
                                Err(format!("Invalid transaction kind: {}", transaction.kind))?
                            }
                        }
                    }
                    Err(e) => Err(e.1)?,
                }
            } else if ic_token.icrc1 {
                // use query_blocks
                let block_args = GetBlocksArgs {
                    start: nat_to_u64(block_id).ok_or_else(|| format!("ICP ledger block id {:?} not found", block_id))?,
                    length: 1,
                };
                match query_blocks(*token.canister_id().ok_or("Invalid principal id")?, block_args)
                    .await
                    .map_err(|e| e.1)
                {
                    Ok(query_response) => {
                        let blocks: Vec<Block> = query_response.blocks;
                        let backend_account = kong_settings_map::get().kong_backend;
                        let backend_account_id =
                            AccountIdentifier::new(&backend_account.owner, &Subaccount(backend_account.subaccount.unwrap_or([0; 32])));
                        let amount = Tokens::from_e8s(nat_to_u64(amount).ok_or("Invalid ICP amount")?);
                        for block in blocks.into_iter() {
                            match block.transaction.operation {
                                Some(operation) => match operation {
                                    Operation::Mint { .. } => (),
                                    Operation::Burn { .. } => (),
                                    Operation::Approve {
                                        from, spender, expires_at, ..
                                    } => {
                                        if *transaction_type == TransactionType::Approve {
                                            if from != caller_account_id() {
                                                Err("Approve from does not match caller")?
                                            } else if spender != backend_account_id {
                                                Err("Approve spender does not match Kong backend")?
                                            } else if let Some(expires_at) = expires_at {
                                                if let Some(ts) = ts {
                                                    if expires_at.timestamp_nanos < ts {
                                                        Err("Expired approve timestamp")?
                                                    }
                                                } else {
                                                    Err("Missing approve timestamp")?
                                                }
                                            }
                                            // weird they don't have amount in the approve operation
                                            return Ok(()); // success
                                        }
                                    }
                                    Operation::Transfer {
                                        from,
                                        to,
                                        amount: transfer_amount,
                                        ..
                                    } => {
                                        // ICP ledger seems to combine transfer and transfer_from
                                        if *transaction_type == TransactionType::Transfer
                                            || *transaction_type == TransactionType::TransferFrom
                                        {
                                            if from != caller_account_id() {
                                                Err("Transfer from does not match caller")?
                                            } else if to != backend_account_id {
                                                Err("Transfer to does not match Kong backend")?
                                            } else if transfer_amount != amount {
                                                Err(format!("Invalid transfer amount: rec {:?} exp {:?}", transfer_amount, amount))?
                                            }
                                            return Ok(());
                                        }
                                    }
                                    Operation::TransferFrom { .. } => Err("Unsupported transfer_from for ICP ledger")?,
                                },
                                None => Err("No transactions in the transaction block")?,
                            }
                        }
                    }
                    Err(e) => Err(e)?,
                }
            } else {
                Err("Verify block id not supported for this token")?
            }
        }
        _ => Err("Verify block id not supported for this token")?,
    }

    Err(format!(
        "Failed to verify {} ledger block id {} type: {:?}",
        token.symbol(),
        block_id,
        transaction_type
    ))?
}

/// Verifies that an allowance exists and is sufficient.
#[allow(dead_code)]
pub async fn verify_allowance(
    token: &StableToken,
    amount: &Nat,
    from_principal_id: &Account,
    spender: &Account,
    ts: Option<u64>,
) -> Result<(), String> {
    let user_allowance = icrc2_allowance(from_principal_id, spender, token).await?;
    if *amount > user_allowance.allowance {
        return Err(format!("{} {} allowance required", amount, token.symbol()));
    }

    if let Some(expires_at) = user_allowance.expires_at {
        if let Some(ts) = ts {
            if expires_at < ts {
                return Err("Expired allowance timestamp".to_string());
            }
        } else {
            return Err("Missing allowance timestamp".to_string());
        }
    }

    Ok(())
}

/// Helper function to query an ICRC2 allowance.
#[allow(dead_code)]
async fn icrc2_allowance(from_principal_id: &Account, spender: &Account, token: &StableToken) -> Result<Allowance, String> {
    let allowance_args = AllowanceArgs {
        account: *from_principal_id,
        spender: *spender,
    };

    match ic_cdk::call::<(AllowanceArgs,), (Allowance,)>(
        *token.canister_id().ok_or("Invalid principal id")?,
        "icrc2_allowance",
        (allowance_args,),
    )
    .await
    .map_err(|e| e.1)
    {
        Ok((allowance,)) => Ok(allowance),
        Err(e) => Err(e.to_string())?,
    }
}