use candid::{CandidType, Nat, Principal};
use ic_ledger_types::{query_blocks, AccountIdentifier, Block, GetBlocksArgs, Operation, Subaccount, Tokens};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::allowance::{Allowance, AllowanceArgs};
use icrc_ledger_types::icrc3::blocks::{GetBlocksRequest, GetBlocksResult};
use icrc_ledger_types::icrc3::transactions::{GetTransactionsRequest, GetTransactionsResponse};
use icrc_ledger_types::icrc::generic_value::ICRC3Value;
use num_traits::ToPrimitive;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use super::wumbo::Transaction1;

use crate::helpers::nat_helpers::nat_to_u64;
use crate::ic::get_time::get_time;
use crate::ic::id::{caller_account_id, caller_id};
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_token::ic_token::ICToken;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;

#[cfg(not(feature = "prod"))]
const ICP_CANISTER_ID: &str = "IC.ryjl3-tyaaa-aaaaa-aaaba-cai";
#[cfg(feature = "prod")]
const ICP_CANISTER_ID: &str = "IC.ryjl3-tyaaa-aaaaa-aaaba-cai";
const WUMBO_CANISTER_ID: &str = "IC.wkv3f-iiaaa-aaaap-ag73a-cai";
const DAMONIC_CANISTER_ID: &str = "IC.zzsnb-aaaaa-aaaap-ag66q-cai";
const CLOWN_CANISTER_ID: &str = "IC.iwv6l-6iaaa-aaaal-ajjjq-cai";
const TAGGR_CANISTER_ID: &str = "IC.6qfxa-ryaaa-aaaai-qbhsq-cai";
const SUBACCOUNT_LENGTH: usize = 32; // 32 bytes for subaccount

// TAGGR specific GetBlocksArgs uses nat64 (u64) for both start and length.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct TaggrGetBlocksArgs {
    pub start: u64,
    pub length: u64,
}

/// Represents the type of a transaction.
#[derive(Debug, PartialEq, Eq)]
pub enum TransactionType {
    Approve,
    Transfer,
    TransferFrom,
}

/// Tries to decode an account from ICRC3 value array
fn try_decode_account(icrc3_value_arr: &[ICRC3Value]) -> Option<Account> {
    // Handle Candid encoding (e.g., SNS ledgers)
    if let Some(ICRC3Value::Blob(blob)) = icrc3_value_arr.first() {
        if let Ok(owner) = Principal::try_from_slice(blob) {
            let subaccount = if icrc3_value_arr.len() >= 2 {
                if let Some(ICRC3Value::Blob(blob)) = icrc3_value_arr.get(1) {
                    if blob.len() == SUBACCOUNT_LENGTH {
                        Some(blob.as_slice().try_into().ok()?)
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

// Stores the last successful verification method for a token to speed up future verifications
// A simple in-memory cache used to skip trying methods known to fail
thread_local! {
    static TOKEN_VERIFICATION_METHOD: std::cell::RefCell<std::collections::HashMap<String, VerificationMethod>> = 
        std::cell::RefCell::new(std::collections::HashMap::new());
}

// The verification methods in preferred order for different token types
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum VerificationMethod {
    // Standard methods
    ICRC3GetBlocks,
    GetTransaction,    // Used by Wumbo, Damonic, Clown
    GetTransactions,   // ICRC3 fallback
    QueryBlocks,       // ICP specific
    
    // Special cases that need custom handlers
    TaggrGetBlocks,    // TAGGR has special handling
}

/// verify that the block_id is a transfer from caller, amount matches
/// ts_start timestamp where transfer must be after this time
pub async fn verify_transfer(token: &StableToken, block_id: &Nat, amount: &Nat) -> Result<(), String> {
    let token_address_with_chain = token.address_with_chain();
    let ts_start = get_time() - kong_settings_map::get().transfer_expiry_nanosecs; // only accept transfers within the hour
    
    // Early double-spend check to prevent unnecessary ledger calls
    // This is critical for security to prevent transaction replay attacks
    let token_id = token.token_id();
    if crate::stable_transfer::transfer_map::contain(token_id, block_id) {
        return Err(format!("Duplicate block id #{}", block_id));
    }
    
    match token {
        StableToken::IC(ic_token) => {
            // Determine which verification methods to try based on token type
            // Start with cached method if available, otherwise determine the ideal order
            let verification_methods = get_verification_methods(token_address_with_chain.as_str(), ic_token);
            
            // Try each verification method in order until one succeeds
            for method in verification_methods {
                match method {
                    VerificationMethod::TaggrGetBlocks => {
                        if let Ok(()) = verify_transfer_taggr(token, block_id, amount, ts_start).await {
                            // Cache successful method
                            TOKEN_VERIFICATION_METHOD.with(|cache| {
                                cache.borrow_mut().insert(token_address_with_chain.to_string(), method);
                            });
                            return Ok(());
                        }
                    },
                    VerificationMethod::ICRC3GetBlocks => {
                        if let Ok(()) = verify_transfer_icrc3(token, block_id, amount, ts_start).await {
                            // Cache successful method
                            TOKEN_VERIFICATION_METHOD.with(|cache| {
                                cache.borrow_mut().insert(token_address_with_chain.to_string(), method);
                            });
                            return Ok(());
                        }
                    },
                    VerificationMethod::QueryBlocks => {
                        if let Ok(()) = verify_transfer_icp(token, block_id, amount, ts_start).await {
                            // Cache successful method
                            TOKEN_VERIFICATION_METHOD.with(|cache| {
                                cache.borrow_mut().insert(token_address_with_chain.to_string(), method);
                            });
                            return Ok(());
                        }
                    },
                    VerificationMethod::GetTransaction => {
                        if let Ok(()) = verify_transfer_get_transaction(token, block_id, amount, ts_start).await {
                            // Cache successful method
                            TOKEN_VERIFICATION_METHOD.with(|cache| {
                                cache.borrow_mut().insert(token_address_with_chain.to_string(), method);
                            });
                            return Ok(());
                        }
                    },
                    VerificationMethod::GetTransactions => {
                        if let Ok(()) = verify_transfer_get_transactions(token, block_id, amount, ts_start).await {
                            // Cache successful method
                            TOKEN_VERIFICATION_METHOD.with(|cache| {
                                cache.borrow_mut().insert(token_address_with_chain.to_string(), method);
                            });
                            return Ok(());
                        }
                    },
                }
            }
            
            // If we reach here, all verification methods failed
            Err(format!("Failed to verify {} transfer block id {}", token.symbol(), block_id))?
        }
        _ => Err("Verify transfer not supported for this token")?,
    }
}

// Determines the best order of verification methods to try based on token type
fn get_verification_methods(token_address: &str, ic_token: &ICToken) -> Vec<VerificationMethod> {
    // First check if we have a cached successful method for this token
    let cached_method = TOKEN_VERIFICATION_METHOD.with(|cache| {
        cache.borrow().get(token_address).copied()
    });
    
    if let Some(method) = cached_method {
        // Start with the previously successful method
        let mut methods = vec![method];
        // Add other methods as fallbacks
        for m in [
            VerificationMethod::ICRC3GetBlocks,
            VerificationMethod::QueryBlocks,
            VerificationMethod::GetTransaction,
            VerificationMethod::GetTransactions,
            VerificationMethod::TaggrGetBlocks,
        ] {
            if m != method {
                methods.push(m);
            }
        }
        return methods;
    }
    
    // No cached method, determine the best order based on token type
    let mut methods = Vec::new();
    
    // Special case for TAGGR
    if token_address == TAGGR_CANISTER_ID {
        methods.push(VerificationMethod::TaggrGetBlocks);
        methods.push(VerificationMethod::GetTransactions);
        return methods;
    }
    
    // ICP always uses QueryBlocks
    if token_address == ICP_CANISTER_ID {
        methods.push(VerificationMethod::QueryBlocks);
        return methods;
    }
    
    // Special tokens that use GetTransaction
    if token_address == WUMBO_CANISTER_ID || 
       token_address == DAMONIC_CANISTER_ID || 
       token_address == CLOWN_CANISTER_ID {
        methods.push(VerificationMethod::GetTransaction);
        methods.push(VerificationMethod::GetTransactions);
        return methods;
    }
    
    // For ICRC3 tokens, try ICRC3GetBlocks first
    if ic_token.icrc3 {
        methods.push(VerificationMethod::ICRC3GetBlocks);
        methods.push(VerificationMethod::GetTransactions);
        return methods;
    }
    
    // For ICRC1 tokens without ICRC3, try GetTransactions
    if ic_token.icrc1 {
        methods.push(VerificationMethod::GetTransactions);
        return methods;
    }
    
    // Default fallback sequence - try everything
    methods.push(VerificationMethod::ICRC3GetBlocks);
    methods.push(VerificationMethod::GetTransactions);
    methods.push(VerificationMethod::GetTransaction);
    methods.push(VerificationMethod::QueryBlocks);
    
    methods
}

// Verify using TAGGR's special ICRC3 implementation
async fn verify_transfer_taggr(token: &StableToken, block_id: &Nat, amount: &Nat, ts_start: u64) -> Result<(), String> {
    // TAGGR requires special u64 encoding
    let taggr_args = vec![TaggrGetBlocksArgs {
        start: nat_to_u64(block_id).ok_or_else(|| format!("Block id {:?} too large for u64", block_id))?,
        length: 1,
    }];
    
    let blocks_result = match ic_cdk::call::<(Vec<TaggrGetBlocksArgs>,), (GetBlocksResult,)>(
        *token.canister_id().ok_or("Invalid principal id")?,
        "icrc3_get_blocks",
        (taggr_args,),
    ).await {
        Ok(result) => Ok(result),
        Err(err) => {
            ic_cdk::api::print(format!("TAGGR: Call failed: {:?}", err));
            Err(format!("TAGGR verification failed: {}", err.1))
        }
    }?;
    
    let (blocks_result,) = blocks_result;
    if blocks_result.blocks.is_empty() {
        return Err("TAGGR: No blocks found".to_string());
    }
    
    // Rest of TAGGR verification is similar to ICRC3
    for block in blocks_result.blocks.iter() {
        if let ICRC3Value::Map(fields) = &block.block {
            // First check timestamp
            let timestamp = if let Some(ICRC3Value::Nat(ts)) = fields.get("ts") {
                match ts.0.to_u64() {
                    Some(ts_u64) => ts_u64,
                    None => return Err("TAGGR: Timestamp too large for u64".to_string()),
                }
            } else {
                return Err("TAGGR: Timestamp not found in block".to_string());
            };
            
            // Validation error - expired timestamp is a hard failure
            if timestamp < ts_start {
                return Err("Expired transfer timestamp".to_string());
            }
            
            // Check transaction details
            if let Some(ICRC3Value::Map(tx)) = fields.get("tx") {
                // Check operation type
                let is_transfer = if let Some(ICRC3Value::Text(op)) = tx.get("op") {
                    op == "icrc1_transfer" || op == "1xfer"
                } else if let Some(ICRC3Value::Text(btype)) = fields.get("btype") {
                    btype == "1xfer"
                } else {
                    false
                };
                
                if !is_transfer {
                    return Err("TAGGR: Not a transfer operation".to_string());
                }
                
                // Verify amount
                if let Some(ICRC3Value::Nat(transfer_amount)) = tx.get("amt") {
                    if *transfer_amount != *amount {
                        return Err(format!("Invalid transfer amount: received {:?} expected {:?}", 
                                         transfer_amount, amount));
                    }
                } else {
                    return Err("TAGGR: Amount not found in transaction".to_string());
                }
                
                // Verify sender (from)
                if let Some(ICRC3Value::Array(from_arr)) = tx.get("from") {
                    if let Some(from) = try_decode_account(from_arr) {
                        if from.owner != caller_id().owner {
                            return Err("Transfer from does not match caller".to_string());
                        }
                    } else {
                        return Err("TAGGR: Failed to decode from account".to_string());
                    }
                } else {
                    return Err("TAGGR: From account not found in transaction".to_string());
                }
                
                // Verify recipient (to)
                if let Some(ICRC3Value::Array(to_arr)) = tx.get("to") {
                    if let Some(to) = try_decode_account(to_arr) {
                        let backend_account = kong_settings_map::get().kong_backend;
                        if to.owner != backend_account.owner {
                            return Err("Transfer to does not match Kong backend".to_string());
                        }
                        
                        // If backend has subaccount, verify it matches
                        if let Some(backend_subaccount) = backend_account.subaccount {
                            if let Some(to_subaccount) = to.subaccount {
                                if to_subaccount != backend_subaccount {
                                    return Err("Transfer to subaccount does not match Kong backend".to_string());
                                }
                            } else if backend_subaccount != [0; 32] {
                                return Err("Transfer to missing subaccount".to_string());
                            }
                        }
                    } else {
                        return Err("TAGGR: Failed to decode to account".to_string());
                    }
                } else {
                    return Err("TAGGR: To account not found in transaction".to_string());
                }
                
                // Make sure it's not a transfer_from operation
                if let Some(ICRC3Value::Array(_)) = tx.get("spender") {
                    return Err("Invalid transfer with spender".to_string());
                }
                
                // All verifications passed
                return Ok(());
            } else {
                return Err("TAGGR: Transaction data not found in block".to_string());
            }
        } else {
            return Err("TAGGR: Invalid block format".to_string());
        }
    }
    
    Err("TAGGR: Verification failed".to_string())
}

// Verify using standard ICRC3 implementation
async fn verify_transfer_icrc3(token: &StableToken, block_id: &Nat, amount: &Nat, ts_start: u64) -> Result<(), String> {
    // Standard ICRC3 encoding
    let blocks_args = vec![GetBlocksRequest {
        start: block_id.clone(),
        length: Nat::from(1u64),
    }];
    
    let blocks_result = match ic_cdk::call::<(Vec<GetBlocksRequest>,), (GetBlocksResult,)>(
        *token.canister_id().ok_or("Invalid principal id")?,
        "icrc3_get_blocks",
        (blocks_args,),
    ).await {
        Ok(result) => Ok(result),
        Err(err) => {
            ic_cdk::api::print(format!("ICRC3: Call failed: {:?}", err));
            Err(format!("ICRC3 verification failed: {}", err.1))
        }
    }?;
    
    let (blocks_result,) = blocks_result;
    if blocks_result.blocks.is_empty() {
        return Err("ICRC3: No blocks found".to_string());
    }
    
    for block in blocks_result.blocks.iter() {
        if let ICRC3Value::Map(fields) = &block.block {
            // First check timestamp
            let timestamp = if let Some(ICRC3Value::Nat(ts)) = fields.get("ts") {
                match ts.0.to_u64() {
                    Some(ts_u64) => ts_u64,
                    None => return Err("ICRC3: Timestamp too large for u64".to_string()),
                }
            } else {
                return Err("ICRC3: Timestamp not found in block".to_string());
            };
            
            // Validation error - expired timestamp is a hard failure
            if timestamp < ts_start {
                return Err("Expired transfer timestamp".to_string());
            }
            
            // Check transaction details
            if let Some(ICRC3Value::Map(tx)) = fields.get("tx") {
                // Check operation type
                let is_transfer = if let Some(ICRC3Value::Text(op)) = tx.get("op") {
                    op == "icrc1_transfer" || op == "1xfer"
                } else if let Some(ICRC3Value::Text(btype)) = fields.get("btype") {
                    btype == "1xfer"
                } else {
                    false
                };
                
                if !is_transfer {
                    return Err("ICRC3: Not a transfer operation".to_string());
                }
                
                // Verify amount
                if let Some(ICRC3Value::Nat(transfer_amount)) = tx.get("amt") {
                    if *transfer_amount != *amount {
                        return Err(format!("Invalid transfer amount: received {:?} expected {:?}", 
                                         transfer_amount, amount));
                    }
                } else {
                    return Err("ICRC3: Amount not found in transaction".to_string());
                }
                
                // Verify sender (from)
                if let Some(ICRC3Value::Array(from_arr)) = tx.get("from") {
                    if let Some(from) = try_decode_account(from_arr) {
                        if from.owner != caller_id().owner {
                            return Err("Transfer from does not match caller".to_string());
                        }
                    } else {
                        return Err("ICRC3: Failed to decode from account".to_string());
                    }
                } else {
                    return Err("ICRC3: From account not found in transaction".to_string());
                }
                
                // Verify recipient (to)
                if let Some(ICRC3Value::Array(to_arr)) = tx.get("to") {
                    if let Some(to) = try_decode_account(to_arr) {
                        let backend_account = kong_settings_map::get().kong_backend;
                        if to.owner != backend_account.owner {
                            return Err("Transfer to does not match Kong backend".to_string());
                        }
                        
                        // If backend has subaccount, verify it matches
                        if let Some(backend_subaccount) = backend_account.subaccount {
                            if let Some(to_subaccount) = to.subaccount {
                                if to_subaccount != backend_subaccount {
                                    return Err("Transfer to subaccount does not match Kong backend".to_string());
                                }
                            } else if backend_subaccount != [0; 32] {
                                return Err("Transfer to missing subaccount".to_string());
                            }
                        }
                    } else {
                        return Err("ICRC3: Failed to decode to account".to_string());
                    }
                } else {
                    return Err("ICRC3: To account not found in transaction".to_string());
                }
                
                // Make sure it's not a transfer_from operation
                if let Some(ICRC3Value::Array(_)) = tx.get("spender") {
                    return Err("Invalid transfer with spender".to_string());
                }
                
                // All verifications passed
                return Ok(());
            } else {
                return Err("ICRC3: Transaction data not found in block".to_string());
            }
        } else {
            return Err("ICRC3: Invalid block format".to_string());
        }
    }
    
    Err("ICRC3: Verification failed".to_string())
}

// Verify using ICP ledger's query_blocks method
async fn verify_transfer_icp(token: &StableToken, block_id: &Nat, amount: &Nat, ts_start: u64) -> Result<(), String> {
    // No timeout config needed, using standard call
    
    let block_args = GetBlocksArgs {
        start: nat_to_u64(block_id).ok_or_else(|| format!("ICP ledger block id {:?} not found", block_id))?,
        length: 1,
    };
    
    let query_response = match query_blocks(
        token.canister_id().ok_or("Invalid principal id")?.clone(), 
        block_args
    ).await {
        Ok(response) => response,
        Err(e) => return Err(e.1),
    };
    
    let blocks: Vec<Block> = query_response.blocks;
    if blocks.is_empty() {
        return Err("ICP: No blocks found".to_string());
    }
    
    let backend_account = kong_settings_map::get().kong_backend;
    let backend_account_id = AccountIdentifier::new(
        &backend_account.owner, 
        &Subaccount(backend_account.subaccount.unwrap_or([0; 32]))
    );
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
                        return Err("Transfer from does not match caller".to_string());
                    }
                    if to != backend_account_id {
                        return Err("Transfer to does not match Kong backend".to_string());
                    }
                    if transfer_amount != amount {
                        return Err(format!("Invalid transfer amount: rec {:?} exp {:?}", transfer_amount, amount));
                    }
                    if block.transaction.created_at_time.timestamp_nanos < ts_start {
                        return Err("Expired transfer timestamp".to_string());
                    }
                    return Ok(());
                }
                _ => return Err("ICP: Not a transfer operation".to_string()),
            },
            None => return Err("No transactions in block".to_string()),
        }
    }
    
    Err("ICP: Verification failed".to_string())
}

// Verify using custom get_transaction method (Wumbo, Damonic, Clown)
async fn verify_transfer_get_transaction(token: &StableToken, block_id: &Nat, amount: &Nat, ts_start: u64) -> Result<(), String> {
    let transaction_response = match ic_cdk::call::<(Nat,), (Option<Transaction1>,)>(
        *token.canister_id().ok_or("Invalid principal id")?,
        "get_transaction",
        (block_id.clone(),),
    ).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("get_transaction failed: {}", e.1)),
    }?;
    
    match transaction_response.0 {
        Some(transaction) => {
            if let Some(transfer) = transaction.transfer {
                let from = transfer.from;
                if from.owner != caller_id().owner {
                    return Err("Transfer from does not match caller".to_string());
                }
                let to = transfer.to;
                if to != kong_settings_map::get().kong_backend {
                    return Err("Transfer to does not match Kong backend".to_string());
                }
                let transfer_amount = transfer.amount;
                if transfer_amount != *amount {
                    return Err(format!("Invalid transfer amount: rec {:?} exp {:?}", transfer_amount, amount));
                }
                let timestamp = transaction.timestamp;
                if timestamp < ts_start {
                    return Err("Expired transfer timestamp".to_string());
                }
                return Ok(());
            } else {
                return Err(format!("Invalid transaction kind: {}", transaction.kind));
            }
        },
        None => return Err("No transaction found".to_string()),
    }
}

// Verify using ICRC3 get_transactions method
async fn verify_transfer_get_transactions(token: &StableToken, block_id: &Nat, amount: &Nat, ts_start: u64) -> Result<(), String> {
    let block_args = GetTransactionsRequest {
        start: block_id.clone(),
        length: Nat::from(1_u32),
    };
    
    let get_transactions_response = match ic_cdk::call::<(GetTransactionsRequest,), (GetTransactionsResponse,)>(
        *token.canister_id().ok_or("Invalid principal id")?,
        "get_transactions",
        (block_args,),
    ).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("get_transactions failed: {}", e.1)),
    }?;
    
    let transactions = get_transactions_response.0.transactions;
    if transactions.is_empty() {
        return Err("No transactions found".to_string());
    }
    
    for transaction in transactions.into_iter() {
        if let Some(transfer) = transaction.transfer {
            let from = transfer.from;
            if from.owner != caller_id().owner {
                return Err("Transfer from does not match caller".to_string());
            }
            let to = transfer.to;
            if to != kong_settings_map::get().kong_backend {
                return Err("Transfer to does not match Kong backend".to_string());
            }
            // make sure spender is None so not an icrc2_transfer_from transaction
            let spender = transfer.spender;
            if spender.is_some() {
                return Err("Invalid transfer spender".to_string());
            }
            let transfer_amount = transfer.amount;
            if transfer_amount != *amount {
                return Err(format!("Invalid transfer amount: rec {:?} exp {:?}", transfer_amount, amount));
            }
            let timestamp = transaction.timestamp;
            if timestamp < ts_start {
                return Err("Expired transfer timestamp".to_string());
            }
            return Ok(());
        }
    }
    
    Err(format!("Failed to verify {} transfer block id {}", token.symbol(), block_id))
}

#[allow(dead_code)]
pub async fn verify_block_id(
    token: &StableToken,
    block_id: &Nat,
    amount: &Nat,
    transaction_type: &TransactionType,
    ts: Option<u64>, // if icrc2_approve has an expiry timestamp
) -> Result<(), String> {
    // Early double-spend check to prevent unnecessary ledger calls
    // This is critical for security to prevent transaction replay attacks
    if *transaction_type == TransactionType::Transfer || *transaction_type == TransactionType::TransferFrom {
        let token_id = token.token_id();
        if crate::stable_transfer::transfer_map::contain(token_id, block_id) {
            return Err(format!("Duplicate block id #{}", block_id));
        }
    }

    match token {
        StableToken::IC(ic_token) => {
            let token_address_with_chain = token.address_with_chain();
            
            // First try ICRC3's icrc3_get_blocks method (newer standard)
            if token_address_with_chain != ICP_CANISTER_ID {
                let is_taggr = token_address_with_chain == TAGGR_CANISTER_ID;
                
                // Prepare arguments based on token type (special handling for TAGGR)
                let blocks_result = if is_taggr {
                    // TAGGR requires special u64 encoding
                    let taggr_args = vec![TaggrGetBlocksArgs {
                        start: nat_to_u64(block_id).ok_or_else(|| format!("Block id {:?} too large for u64", block_id))?,
                        length: 1,
                    }];
                    
                    ic_cdk::call::<(Vec<TaggrGetBlocksArgs>,), (GetBlocksResult,)>(
                        *token.canister_id().ok_or("Invalid principal id")?,
                        "icrc3_get_blocks",
                        (taggr_args,),
                    )
                    .await
                } else {
                    // Standard ICRC3 encoding
                    let blocks_args = vec![GetBlocksRequest {
                        start: block_id.clone(),
                        length: Nat::from(1u64),
                    }];
                    
                    ic_cdk::call::<(Vec<GetBlocksRequest>,), (GetBlocksResult,)>(
                        *token.canister_id().ok_or("Invalid principal id")?,
                        "icrc3_get_blocks",
                        (blocks_args,),
                    )
                    .await
                };

                match blocks_result {
                    Ok((blocks_result,)) => {
                        if blocks_result.blocks.is_empty() {
                            // If no blocks found, we'll fall through to other methods
                            ic_cdk::api::print(format!("ICRC3 verify_block_id: No blocks found for id {}, falling back", block_id));
                        } else {
                            for block in blocks_result.blocks.iter() {
                                if let ICRC3Value::Map(fields) = &block.block {
                                    // First check transaction details
                                    if let Some(ICRC3Value::Map(tx)) = fields.get("tx") {
                                        match transaction_type {
                                            TransactionType::Transfer | TransactionType::TransferFrom => {
                                                // Check operation type
                                                let is_transfer = if let Some(ICRC3Value::Text(op)) = tx.get("op") {
                                                    op == "icrc1_transfer" || op == "1xfer"
                                                } else if let Some(ICRC3Value::Text(btype)) = fields.get("btype") {
                                                    btype == "1xfer"
                                                } else {
                                                    false
                                                };
                                                
                                                if !is_transfer {
                                                    continue; // Not the operation we're looking for
                                                }
                                                
                                                // Verify amount
                                                if let Some(ICRC3Value::Nat(transfer_amount)) = tx.get("amt") {
                                                    // Validation error - amount mismatch is a hard failure
                                                    if *transfer_amount != *amount {
                                                        return Err(format!("Invalid transfer amount: received {:?} expected {:?}", 
                                                                        transfer_amount, amount));
                                                    }
                                                } else {
                                                    // Structural error - amount not found, try fallback
                                                    ic_cdk::api::print("ICRC3 verify_block_id: Amount not found in transaction, falling back");
                                                    break; 
                                                }
                                                
                                                // Verify sender (from)
                                                if let Some(ICRC3Value::Array(from_arr)) = tx.get("from") {
                                                    if let Some(from) = try_decode_account(from_arr) {
                                                        // Validation error - sender mismatch is a hard failure
                                                        if from.owner != caller_id().owner {
                                                            return Err("Transfer from does not match caller".to_string());
                                                        }
                                                    } else {
                                                        // Structural error - can't decode from account, try fallback
                                                        ic_cdk::api::print("ICRC3 verify_block_id: Failed to decode from account, falling back");
                                                        break;
                                                    }
                                                } else {
                                                    // Structural error - from field missing, try fallback
                                                    ic_cdk::api::print("ICRC3 verify_block_id: From account not found in transaction, falling back");
                                                    break;
                                                }
                                                
                                                // Verify recipient (to)
                                                if let Some(ICRC3Value::Array(to_arr)) = tx.get("to") {
                                                    if let Some(to) = try_decode_account(to_arr) {
                                                        let backend_account = kong_settings_map::get().kong_backend;
                                                        // Validation error - recipient mismatch is a hard failure
                                                        if to.owner != backend_account.owner {
                                                            return Err("Transfer to does not match Kong backend".to_string());
                                                        }
                                                        
                                                        // If backend has subaccount, verify it matches
                                                        if let Some(backend_subaccount) = backend_account.subaccount {
                                                            if let Some(to_subaccount) = to.subaccount {
                                                                // Validation error - subaccount mismatch is a hard failure
                                                                if to_subaccount != backend_subaccount {
                                                                    return Err("Transfer to subaccount does not match Kong backend".to_string());
                                                                }
                                                            } else if backend_subaccount != [0; 32] {
                                                                // Validation error - missing required subaccount is a hard failure
                                                                return Err("Transfer to missing subaccount".to_string());
                                                            }
                                                        }
                                                    } else {
                                                        // Structural error - can't decode to account, try fallback
                                                        ic_cdk::api::print("ICRC3 verify_block_id: Failed to decode to account, falling back");
                                                        break;
                                                    }
                                                } else {
                                                    // Structural error - to field missing, try fallback
                                                    ic_cdk::api::print("ICRC3 verify_block_id: To account not found in transaction, falling back");
                                                    break;
                                                }
                                                
                                                // For TransferFrom, verify the spender is Kong backend
                                                if *transaction_type == TransactionType::TransferFrom {
                                                    if let Some(ICRC3Value::Array(spender_arr)) = tx.get("spender") {
                                                        if let Some(spender) = try_decode_account(spender_arr) {
                                                            let backend_account = kong_settings_map::get().kong_backend;
                                                            // Validation error - spender mismatch is a hard failure
                                                            if spender.owner != backend_account.owner {
                                                                return Err("Transfer spender does not match Kong backend".to_string());
                                                            }
                                                        } else {
                                                            // Structural error - can't decode spender, try fallback
                                                            ic_cdk::api::print("ICRC3 verify_block_id: Failed to decode spender account, falling back");
                                                            break;
                                                        }
                                                    } else {
                                                        // Structural error - spender missing for TransferFrom, try fallback
                                                        ic_cdk::api::print("ICRC3 verify_block_id: Missing spender for TransferFrom operation, falling back");
                                                        break;
                                                    }
                                                } else if let Some(ICRC3Value::Array(_)) = tx.get("spender") {
                                                    // Validation error - unexpected spender for regular transfer is a hard failure
                                                    return Err("Invalid transfer with spender".to_string());
                                                }
                                                
                                                // All verifications passed
                                                return Ok(());
                                            },
                                            TransactionType::Approve => {
                                                // Check operation type
                                                let is_approve = if let Some(ICRC3Value::Text(op)) = tx.get("op") {
                                                    op == "icrc2_approve" || op == "2apr"
                                                } else if let Some(ICRC3Value::Text(btype)) = fields.get("btype") {
                                                    btype == "2apr"
                                                } else {
                                                    false
                                                };
                                                
                                                if !is_approve {
                                                    continue; // Not the operation we're looking for
                                                }
                                                
                                                // Verify approve amount
                                                if let Some(ICRC3Value::Nat(approve_amount)) = tx.get("amt") {
                                                    // Validation error - insufficient approve amount is a hard failure
                                                    if *approve_amount < *amount {
                                                        return Err(format!("Insufficient approve amount: {:?} required >= {:?}", 
                                                                        approve_amount, amount));
                                                    }
                                                } else {
                                                    // Structural error - amount not found, try fallback
                                                    ic_cdk::api::print("ICRC3 verify_block_id: Amount not found in approve transaction, falling back");
                                                    break;
                                                }
                                                
                                                // Verify sender (from)
                                                if let Some(ICRC3Value::Array(from_arr)) = tx.get("from") {
                                                    if let Some(from) = try_decode_account(from_arr) {
                                                        // Validation error - sender mismatch is a hard failure
                                                        if from.owner != caller_id().owner {
                                                            return Err("Approve from does not match caller".to_string());
                                                        }
                                                    } else {
                                                        // Structural error - can't decode from account, try fallback
                                                        ic_cdk::api::print("ICRC3 verify_block_id: Failed to decode from account in approve, falling back");
                                                        break;
                                                    }
                                                } else {
                                                    // Structural error - from field missing, try fallback
                                                    ic_cdk::api::print("ICRC3 verify_block_id: From account not found in approve transaction, falling back");
                                                    break;
                                                }
                                                
                                                // Verify spender is Kong backend
                                                if let Some(ICRC3Value::Array(spender_arr)) = tx.get("spender") {
                                                    if let Some(spender) = try_decode_account(spender_arr) {
                                                        let backend_account = kong_settings_map::get().kong_backend;
                                                        // Validation error - spender mismatch is a hard failure
                                                        if spender.owner != backend_account.owner {
                                                            return Err("Approve spender does not match Kong backend".to_string());
                                                        }
                                                    } else {
                                                        // Structural error - can't decode spender, try fallback
                                                        ic_cdk::api::print("ICRC3 verify_block_id: Failed to decode spender account in approve, falling back");
                                                        break;
                                                    }
                                                } else {
                                                    // Structural error - spender missing, try fallback
                                                    ic_cdk::api::print("ICRC3 verify_block_id: Spender not found in approve transaction, falling back");
                                                    break;
                                                }
                                                
                                                // Check expiry timestamp if required
                                                if let Some(ICRC3Value::Nat(expires_at)) = tx.get("expt") {
                                                    if let Some(ts_value) = ts {
                                                        let expires_nat = match expires_at.0.to_u64() {
                                                            Some(ts_u64) => ts_u64,
                                                            None => {
                                                                // Structural error - timestamp too large, try fallback
                                                                ic_cdk::api::print("ICRC3 verify_block_id: Expiry timestamp too large, falling back");
                                                                break;
                                                            }
                                                        };
                                                        // Validation error - expired timestamp is a hard failure
                                                        if expires_nat < ts_value {
                                                            return Err("Expired approve timestamp".to_string());
                                                        }
                                                    } else {
                                                        // Validation error - missing timestamp when expiry exists is a hard failure
                                                        return Err("Missing approve expiry timestamp".to_string());
                                                    }
                                                }
                                                
                                                // All verifications passed for approve
                                                return Ok(());
                                            }
                                        }
                                    } else {
                                        // Structural error - tx field missing, try fallback
                                        ic_cdk::api::print("ICRC3 verify_block_id: Transaction data not found in block, falling back");
                                        break;
                                    }
                                } else {
                                    // Structural error - invalid block format, try fallback
                                    ic_cdk::api::print("ICRC3 verify_block_id: Invalid block format, falling back");
                                    break;
                                }
                            }
                            // If we reached here, no valid blocks were found or verification failed
                            // We'll continue to fallback methods
                            ic_cdk::api::print(format!("ICRC3 verify_block_id: Verification failed for block {}, trying fallback methods", block_id));
                        }
                    }
                    Err(err) => {
                        // If icrc3_get_blocks failed, we'll try other methods
                        ic_cdk::api::print(format!("ICRC3 verify_block_id: Call failed: {:?}, trying fallback methods", err));
                    }
                }
            }
            
            // If ICRC3 didn't succeed, try other methods
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
                                    if from.owner != caller_id().owner {
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
                                    if from.owner != caller_id().owner {
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

#[allow(dead_code)]
pub async fn icrc2_allowance(from_principal_id: &Account, spender: &Account, token: &StableToken) -> Result<Allowance, String> {
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
