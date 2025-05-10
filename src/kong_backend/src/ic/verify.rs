use candid::{CandidType, Nat, Principal};
use ic_ledger_types::{query_blocks, AccountIdentifier, GetBlocksArgs, Operation, Subaccount, Tokens};
use icrc_ledger_types::icrc::generic_value::ICRC3Value;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::allowance::{Allowance, AllowanceArgs};
use icrc_ledger_types::icrc3::blocks::{GetBlocksRequest, GetBlocksResult, ICRC3GenericBlock};
use icrc_ledger_types::icrc3::transactions::{GetTransactionsRequest, GetTransactionsResponse};
use num_traits::cast::ToPrimitive;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use super::wumbo::Transaction1;

use crate::helpers::nat_helpers::nat_to_u64;
use crate::ic::get_time::get_time;
use crate::ic::id::{caller_account_id, caller_id};
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;

#[cfg(not(feature = "prod"))]
const ICP_CANISTER_ID: &str = "IC.nppha-riaaa-aaaal-ajf2q-cai"; // Testnet ICP Ledger
#[cfg(feature = "prod")]
const ICP_CANISTER_ID: &str = "IC.ryjl3-tyaaa-aaaaa-aaaba-cai"; // Mainnet ICP Ledger
const WUMBO_CANISTER_ID: &str = "IC.wkv3f-iiaaa-aaaap-ag73a-cai";
const DAMONIC_CANISTER_ID: &str = "IC.zzsnb-aaaaa-aaaap-ag66q-cai";
const CLOWN_CANISTER_ID: &str = "IC.iwv6l-6iaaa-aaaal-ajjjq-cai";
const TAGGR_CANISTER_ID: &str = "IC.6qfxa-ryaaa-aaaai-qbhsq-cai";
const SUBACCOUNT_LENGTH: usize = 32;

/// Represents the type of a transaction being verified (not necessarily the block type).
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum TransactionType {
    Approve,
    Transfer,
    TransferFrom,
}

/// Used by verification helper functions to determine if a fallback should be attempted.
#[derive(Debug)]
enum VerificationError {
    Hard(String), // A definitive validation failure for the transaction. Stop.
    Soft(String), // Method failed (e.g., call error, block not found by this method). Try fallback.
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct TaggrGetBlocksArgs {
    pub start: u64,
    pub length: u64,
}

#[derive(Debug)]
struct ParsedICRC3TransactionInfo {
    op: String,
    timestamp: u64,
    amount: Nat,
    from: Account,
    to: Option<Account>,
    spender: Option<Account>,
}

fn try_decode_icrc3_account_value(icrc3_value_arr: &[ICRC3Value]) -> Option<Account> {
    if let Some(ICRC3Value::Blob(blob)) = icrc3_value_arr.first() {
        if let Ok(owner) = Principal::try_from_slice(blob) {
            let subaccount = if icrc3_value_arr.len() >= 2 {
                icrc3_value_arr.get(1).and_then(|val| match val {
                    ICRC3Value::Blob(blob2) if blob2.len() == SUBACCOUNT_LENGTH => blob2.as_slice().try_into().ok(),
                    _ => None,
                })
            } else {
                None
            };
            return Some(Account { owner, subaccount });
        }
    }

    if icrc3_value_arr.len() == 1 {
        if let Some(ICRC3Value::Blob(blob)) = icrc3_value_arr.first() {
            if let Ok(map) = ciborium::de::from_reader::<BTreeMap<String, ciborium::value::Value>, _>(blob.as_slice()) {
                let owner_bytes = match map.get("owner") {
                    Some(ciborium::value::Value::Bytes(bytes)) => bytes.as_slice(),
                    _ => return None,
                };
                let owner = Principal::try_from_slice(owner_bytes).ok()?;
                let subaccount = map.get("subaccount").and_then(|val| match val {
                    ciborium::value::Value::Bytes(bytes) if !bytes.is_empty() && bytes.len() == SUBACCOUNT_LENGTH => {
                        let mut sa = [0u8; SUBACCOUNT_LENGTH];
                        sa.copy_from_slice(bytes);
                        Some(sa)
                    }
                    _ => None,
                });
                return Some(Account { owner, subaccount });
            }
        }
    }
    None
}

fn process_icrc3_generic_block_value(block_value: &ICRC3GenericBlock) -> Result<ParsedICRC3TransactionInfo, String> {
    if let ICRC3Value::Map(fields) = block_value {
        let timestamp = fields
            .get("ts")
            .and_then(|v| match v {
                ICRC3Value::Nat(ts_nat) => ts_nat.0.to_u64(),
                _ => None,
            })
            .ok_or_else(|| "Timestamp ('ts') not found or invalid in ICRC3 block".to_string())?;

        let mut op: Option<String> = None;
        let mut amount: Option<Nat> = None;
        let mut from: Option<Account> = None;
        let mut to: Option<Account> = None;
        let mut spender: Option<Account> = None;

        if let Some(ICRC3Value::Text(op_text)) = fields.get("btype") {
            op = Some(op_text.clone());
        }

        if let Some(ICRC3Value::Map(tx_details)) = fields.get("tx") {
            if let Some(ICRC3Value::Text(op_text)) = tx_details.get("op") {
                op = Some(op_text.clone()); // 'tx.op' overrides 'btype'
            }
            if let Some(ICRC3Value::Nat(amt_nat)) = tx_details.get("amt") {
                amount = Some(amt_nat.clone());
            }
            if let Some(ICRC3Value::Array(arr)) = tx_details.get("from") {
                from = try_decode_icrc3_account_value(arr);
            }
            if let Some(ICRC3Value::Array(arr)) = tx_details.get("to") {
                to = try_decode_icrc3_account_value(arr);
            }
            if let Some(ICRC3Value::Array(arr)) = tx_details.get("spender") {
                spender = try_decode_icrc3_account_value(arr);
            }
        } else {
            // No 'tx' map, expect fields at top level (e.g., TAGGR style)
            if let Some(ICRC3Value::Nat(amt_nat)) = fields.get("amt") {
                amount = Some(amt_nat.clone());
            }
            if let Some(ICRC3Value::Array(arr)) = fields.get("from") {
                from = try_decode_icrc3_account_value(arr);
            }
            if let Some(ICRC3Value::Array(arr)) = fields.get("to") {
                to = try_decode_icrc3_account_value(arr);
            }
            if let Some(ICRC3Value::Array(arr)) = fields.get("spender") {
                spender = try_decode_icrc3_account_value(arr);
            }
        }

        Ok(ParsedICRC3TransactionInfo {
            op: op.ok_or_else(|| "Operation type ('op' or 'btype') not found".to_string())?,
            timestamp,
            amount: amount.ok_or_else(|| "Amount ('amt') not found".to_string())?,
            from: from.ok_or_else(|| "From account ('from') not found".to_string())?,
            to,
            spender,
        })
    } else {
        Err("Invalid ICRC3 block format: Expected a map".to_string())
    }
}

/// Common helper to verify transfer details once parsed from any ledger type.
fn verify_parsed_transfer_details(
    tx_from: &Account,
    tx_to: Option<&Account>,
    tx_spender: Option<&Account>,
    tx_amount: &Nat,
    tx_timestamp: u64,
    expected_caller: &Account,
    expected_kong_backend: &Account,
    expected_amount_arg: &Nat,
    min_valid_timestamp: u64,
    context_prefix: &str,
) -> Result<(), String> {
    if tx_from != expected_caller {
        return Err(format!(
            "{} Verification: Transfer 'from' ({:?}) does not match expected caller ({:?})",
            context_prefix, tx_from, expected_caller
        ));
    }

    let actual_to_account = tx_to.ok_or_else(|| {
        format!(
            "{} Verification: Transfer 'to' account is missing in transaction data",
            context_prefix
        )
    })?;

    if actual_to_account != expected_kong_backend {
        return Err(format!(
            "{} Verification: Transfer 'to' ({:?}) does not match Kong backend ({:?})",
            context_prefix, actual_to_account, expected_kong_backend
        ));
    }

    if tx_spender.is_some() {
        return Err(format!(
            "{} Verification: Spender was present ({:?}), but expected None for a direct transfer.",
            context_prefix, tx_spender
        ));
    }

    if tx_amount != expected_amount_arg {
        return Err(format!(
            "{} Verification: Invalid transfer amount. Received {:?}, expected {:?}.",
            context_prefix, tx_amount, expected_amount_arg
        ));
    }

    if tx_timestamp < min_valid_timestamp {
        return Err(format!(
            "{} Verification: Expired transfer timestamp. Transaction time: {}, required after: {}.",
            context_prefix, tx_timestamp, min_valid_timestamp
        ));
    }
    Ok(())
}

// --- Verification Method Helpers for verify_transfer ---
async fn attempt_icrc3_get_blocks_verification(
    token: &StableToken,
    block_id_arg: &Nat,
    expected_amount_arg: &Nat,
    current_caller_account: &Account,
    kong_backend_account: &Account,
    min_valid_timestamp: u64,
) -> Result<(), VerificationError> {
    let canister_id = *token
        .canister_id()
        .ok_or_else(|| VerificationError::Soft("Token missing canister_id for icrc3_get_blocks".to_string()))?;
    let token_address_chain = token.address_with_chain();

    let blocks_result_tuple: Result<(GetBlocksResult,), _> = if token_address_chain == TAGGR_CANISTER_ID {
        let args = vec![TaggrGetBlocksArgs {
            start: nat_to_u64(block_id_arg)
                .ok_or_else(|| VerificationError::Soft(format!("TAGGR ICRC3: Block ID {:?} cannot be u64", block_id_arg)))?,
            length: 1,
        }];
        ic_cdk::call(canister_id, "icrc3_get_blocks", (args,)).await
    } else {
        let args = GetBlocksRequest {
            start: block_id_arg.clone(),
            length: Nat::from(1u32),
        };
        ic_cdk::call(canister_id, "icrc3_get_blocks", (args,)).await
    };

    match blocks_result_tuple {
        Ok(get_blocks_response) => {
            let blocks_data = get_blocks_response.0;
            if blocks_data.blocks.is_empty() {
                return Err(VerificationError::Soft(format!(
                    "ICRC3 get_blocks for {}: No blocks returned for block_id {}",
                    token.symbol(),
                    block_id_arg
                )));
            }

            for block_envelope in blocks_data.blocks.iter() {
                // If ledger returns a range, we need to ensure we are processing the correct block by ID.
                // For length 1, we expect block_envelope.id to be block_id_arg.
                if block_envelope.id != *block_id_arg {
                    continue; // Not the specific block we requested by ID, skip.
                }

                match process_icrc3_generic_block_value(&block_envelope.block) {
                    Ok(tx_info) => {
                        if matches!(tx_info.op.as_str(), "icrc1_transfer" | "1xfer" | "transfer" | "xfer") {
                            match verify_parsed_transfer_details(
                                &tx_info.from,
                                tx_info.to.as_ref(),
                                tx_info.spender.as_ref(),
                                &tx_info.amount,
                                tx_info.timestamp,
                                current_caller_account,
                                kong_backend_account,
                                expected_amount_arg,
                                min_valid_timestamp,
                                "ICRC3 GetBlocks",
                            ) {
                                Ok(()) => return Ok(()), // Success!
                                Err(hard_fail_msg) => return Err(VerificationError::Hard(hard_fail_msg)),
                            }
                        }
                        // If op type doesn't match, this specific block isn't a verifiable transfer.
                        // Continue loop in case other blocks were (unexpectedly) returned.
                    }
                    Err(parse_err) => {
                        return Err(VerificationError::Soft(format!(
                            // Soft, as block data might be malformed.
                            "ICRC3 get_blocks for {}: Failed to parse block {}: {}",
                            token.symbol(),
                            block_id_arg,
                            parse_err
                        )));
                    }
                }
            }
            // If loop finishes, no block with matching ID led to successful verification.
            Err(VerificationError::Soft(format!(
                "ICRC3 get_blocks for {}: Transfer verification conditions not met for block_id {}",
                token.symbol(),
                block_id_arg
            )))
        }
        Err((rc, msg)) => Err(VerificationError::Soft(format!(
            "ICRC3 get_blocks call failed for {}: {:?} - {}",
            token.symbol(),
            rc,
            msg
        ))),
    }
}

async fn attempt_generic_get_transactions_verification(
    token: &StableToken,
    transaction_start_index_arg: &Nat, // block_id is used as start index here
    expected_amount_arg: &Nat,
    current_caller_account: &Account,
    kong_backend_account: &Account,
    min_valid_timestamp: u64,
) -> Result<(), VerificationError> {
    let canister_id = *token
        .canister_id()
        .ok_or_else(|| VerificationError::Soft("Token missing canister_id for get_transactions".to_string()))?;
    let args = GetTransactionsRequest {
        start: transaction_start_index_arg.clone(),
        length: Nat::from(1u32),
    };

    match ic_cdk::call::<(GetTransactionsRequest,), (GetTransactionsResponse,)>(canister_id, "get_transactions", (args,)).await {
        Ok(get_transactions_response_tuple) => {
            let response: GetTransactionsResponse = get_transactions_response_tuple.0;
            if response.transactions.is_empty() {
                return Err(VerificationError::Soft(format!(
                    "GetTransactions for {}: No transactions returned for start_index {}",
                    token.symbol(),
                    transaction_start_index_arg
                )));
            }
            for tx in response.transactions.into_iter() {
                // Assuming the first transaction is the one we care about for length 1.
                // ICRC-1 GetTransactions doesn't reference block_id directly in the response items.
                if let Some(transfer_details) = tx.transfer {
                    match verify_parsed_transfer_details(
                        &transfer_details.from,
                        Some(&transfer_details.to),
                        transfer_details.spender.as_ref(),
                        &transfer_details.amount,
                        tx.timestamp,
                        current_caller_account,
                        kong_backend_account,
                        expected_amount_arg,
                        min_valid_timestamp,
                        "GetTransactions",
                    ) {
                        Ok(()) => return Ok(()), // Success!
                        Err(hard_fail_msg) => return Err(VerificationError::Hard(hard_fail_msg)),
                    }
                }
                // Other tx kinds are ignored for direct transfer verification.
            }
            Err(VerificationError::Soft(format!(
                "GetTransactions for {}: Transfer verification conditions not met for start_index {}",
                token.symbol(),
                transaction_start_index_arg
            )))
        }
        Err((rc, msg)) => Err(VerificationError::Soft(format!(
            "GetTransactions call failed for {}: {:?} - {}",
            token.symbol(),
            rc,
            msg
        ))),
    }
}

async fn attempt_icp_ledger_query_blocks_verification(
    token: &StableToken,
    block_id_arg: &Nat,
    expected_amount_arg: &Nat,
    current_caller_icp_account_id: &AccountIdentifier,
    kong_backend_icp_account_id: &AccountIdentifier,
    min_valid_timestamp: u64,
) -> Result<(), VerificationError> {
    let canister_id = *token
        .canister_id()
        .ok_or_else(|| VerificationError::Soft("Token missing canister_id for ICP query_blocks".to_string()))?;
    let start_u64 = nat_to_u64(block_id_arg).ok_or_else(|| VerificationError::Soft(format!("ICP: Block ID {:?} invalid", block_id_arg)))?;
    let expected_tokens = Tokens::from_e8s(
        nat_to_u64(expected_amount_arg).ok_or_else(|| VerificationError::Soft(format!("ICP: Amount {:?} invalid", expected_amount_arg)))?,
    );

    let args = GetBlocksArgs {
        start: start_u64,
        length: 1,
    };
    match query_blocks(canister_id, args).await {
        // ic_ledger_types::query_blocks
        Ok(query_response) => {
            if query_response.blocks.is_empty() {
                return Err(VerificationError::Soft(format!(
                    "ICP query_blocks for {}: No blocks for index {}",
                    token.symbol(),
                    start_u64
                )));
            }
            for block_data in query_response.blocks.into_iter() {
                // Assuming the first block is the one we care about for length 1.
                if let Some(Operation::Transfer {
                    from,
                    to,
                    amount: transfer_amount,
                    ..
                }) = block_data.transaction.operation
                {
                    if from != *current_caller_icp_account_id {
                        return Err(VerificationError::Hard(format!(
                            "ICP Transfer: 'from' ({:?}) != caller ({:?})",
                            from, current_caller_icp_account_id
                        )));
                    }
                    if to != *kong_backend_icp_account_id {
                        return Err(VerificationError::Hard(format!(
                            "ICP Transfer: 'to' ({:?}) != backend ({:?})",
                            to, kong_backend_icp_account_id
                        )));
                    }
                    if transfer_amount != expected_tokens {
                        return Err(VerificationError::Hard(format!(
                            "ICP Transfer: Amount {:?} != expected {:?}",
                            transfer_amount, expected_tokens
                        )));
                    }
                    if block_data.transaction.created_at_time.timestamp_nanos < min_valid_timestamp {
                        return Err(VerificationError::Hard("ICP Transfer: Expired timestamp".to_string()));
                    }
                    return Ok(()); // Success!
                }
            }
            Err(VerificationError::Soft(format!(
                "ICP query_blocks for {}: Transfer verification conditions not met for index {}",
                token.symbol(),
                start_u64
            )))
        }
        Err((_code, msg)) => Err(VerificationError::Soft(format!(
            // query_blocks returns (code, string)
            "ICP query_blocks call failed for {}: {}",
            token.symbol(),
            msg
        ))),
    }
}

async fn attempt_special_ledger_get_transaction_verification(
    token: &StableToken,
    block_id_arg: &Nat,
    expected_amount_arg: &Nat,
    current_caller_account: &Account,
    kong_backend_account: &Account,
    min_valid_timestamp: u64,
) -> Result<(), VerificationError> {
    let canister_id = *token
        .canister_id()
        .ok_or_else(|| VerificationError::Soft("Token missing canister_id for special get_transaction".to_string()))?;

    match ic_cdk::call(canister_id, "get_transaction", (block_id_arg.clone(),)).await {
        Ok(response_tuple_option) => {
            let response_tuple: (Option<Transaction1>,) = response_tuple_option; 
            if let Some(transaction_data) = response_tuple.0 {
                if let Some(transfer_details) = transaction_data.transfer {
                    match verify_parsed_transfer_details(
                        &transfer_details.from,
                        Some(&transfer_details.to),
                        None,
                        &transfer_details.amount,
                        transaction_data.timestamp,
                        current_caller_account,
                        kong_backend_account,
                        expected_amount_arg,
                        min_valid_timestamp,
                        &format!("Special Ledger ({}) GetTransaction", token.symbol()),
                    ) {
                        Ok(()) => return Ok(()), 
                        Err(hard_fail_msg) => return Err(VerificationError::Hard(hard_fail_msg)),
                    }
                } else {
                    return Err(VerificationError::Soft(format!(
                        "Special Ledger ({}) GetTransaction: Tx kind {} is not simple transfer",
                        token.symbol(),
                        transaction_data.kind
                    )));
                }
            } else {
                Err(VerificationError::Soft(format!(
                    "Special Ledger ({}) GetTransaction: No transaction found for block_id {}",
                    token.symbol(),
                    block_id_arg
                )))
            }
        }
        Err((rc, msg)) => Err(VerificationError::Soft(format!(
            "Special Ledger ({}) GetTransaction call failed: {:?} - {}",
            token.symbol(),
            rc,
            msg
        ))),
    }
}

/// Verifies a transfer by checking the ledger.
/// Tries different methods based on token type, with fallbacks.
/// `block_id`'s meaning (block index, transaction index) depends on the ledger type.
pub async fn verify_transfer(token: &StableToken, block_id: &Nat, amount: &Nat) -> Result<(), String> {
    let kong_settings = kong_settings_map::get();
    let min_valid_timestamp = get_time() - kong_settings.transfer_expiry_nanosecs;
    let current_caller_account = caller_id(); // ICRC-1 Account of the caller
    let kong_backend_account = kong_settings.kong_backend; // ICRC-1 Account for Kong

    match token {
        StableToken::IC(ic_token_data) => {
            let token_address_chain = token.address_with_chain();

            // --- Strategy: Try most specific/preferred methods first, then fall back. ---

            // 1. If ICRC3 token, try icrc3_get_blocks first.
            if ic_token_data.icrc3 {
                match attempt_icrc3_get_blocks_verification(
                    token,
                    block_id,
                    amount,
                    &current_caller_account,
                    &kong_backend_account,
                    min_valid_timestamp,
                )
                .await
                {
                    Ok(()) => return Ok(()), // Verified by icrc3_get_blocks
                    Err(VerificationError::Hard(msg)) => return Err(msg),
                    Err(VerificationError::Soft(_)) => {
                        // Fall through to attempt_generic_get_transactions_verification for this ICRC3 token
                    }
                }
                // Fallback for ICRC3: Try generic get_transactions
                return attempt_generic_get_transactions_verification(
                    token,
                    block_id, // block_id is used as start_index for get_transactions
                    amount,
                    &current_caller_account,
                    &kong_backend_account,
                    min_valid_timestamp,
                )
                .await
                .map_err(|e| match e {
                    VerificationError::Hard(m) | VerificationError::Soft(m) => {
                        format!("ICRC3 Fallback (GetTransactions) for {}: {}", token.symbol(), m)
                    }
                });
            }

            // 2. If ICP Ledger token (and not ICRC3, or ICRC3 attempts failed).
            //    Note: ICP ledger itself isn't ICRC3, but some tokens might be both.
            //    The check `ic_token_data.icrc3` above handles ICRC3 primary attempt.
            //    This `else if` is for non-ICRC3 ICP or if an ICRC3 token is *also* on `ICP_CANISTER_ID`
            //    and the ICRC3 methods failed.
            if token_address_chain == ICP_CANISTER_ID {
                let current_caller_icp_account_id = caller_account_id(); // Ledger AccountIdentifier
                let kong_backend_icp_account_id = AccountIdentifier::new(
                    &kong_backend_account.owner,
                    &Subaccount(kong_backend_account.subaccount.unwrap_or_default()),
                );
                return attempt_icp_ledger_query_blocks_verification(
                    token,
                    block_id,
                    amount,
                    &current_caller_icp_account_id,
                    &kong_backend_icp_account_id,
                    min_valid_timestamp,
                )
                .await
                .map_err(|e| match e {
                    VerificationError::Hard(m) | VerificationError::Soft(m) => {
                        format!("ICP Ledger for {}: {}", token.symbol(), m)
                    }
                });
            }

            // 3. If special ledger token (WUMBO, etc.)
            if token_address_chain == WUMBO_CANISTER_ID
                || token_address_chain == DAMONIC_CANISTER_ID
                || token_address_chain == CLOWN_CANISTER_ID
            {
                return attempt_special_ledger_get_transaction_verification(
                    token,
                    block_id,
                    amount,
                    &current_caller_account,
                    &kong_backend_account,
                    min_valid_timestamp,
                )
                .await
                .map_err(|e| match e {
                    VerificationError::Hard(m) | VerificationError::Soft(m) => {
                        format!("Special Ledger ({}) for {}: {}", token_address_chain, token.symbol(), m)
                    }
                });
            }

            return attempt_generic_get_transactions_verification(
                token,
                block_id, // block_id is used as start_index for get_transactions
                amount,
                &current_caller_account,
                &kong_backend_account,
                min_valid_timestamp,
            )
            .await
            .map_err(|e| match e {
                VerificationError::Hard(m) | VerificationError::Soft(m) => {
                    format!("Generic Fallback (GetTransactions) for {}: {}", token.symbol(), m)
                }
            });
        }
        _ => Err("Verify transfer not supported for this non-IC token category".to_string()),
    }
}

#[allow(dead_code)]
pub async fn verify_block_id(
    token: &StableToken,
    block_id: &Nat,
    amount: &Nat,
    transaction_type: &TransactionType,
    ts: Option<u64>, // Optional required expiry for approves
) -> Result<(), String> {
    // Get common values
    let current_caller_account = caller_id();
    let kong_backend_account = kong_settings_map::get().kong_backend;
    // General transaction expiry, separate from specific approve.expires_at
    let general_tx_min_valid_timestamp = get_time() - kong_settings_map::get().transfer_expiry_nanosecs;

    match token {
        StableToken::IC(ic_token_data) => {
            // ICRC3 tokens (usually use get_transactions for this type of verification)
            if ic_token_data.icrc3 {
                let args = GetTransactionsRequest {
                    start: block_id.clone(),
                    length: Nat::from(1u32),
                };
                match ic_cdk::call::<(GetTransactionsRequest,), (GetTransactionsResponse,)>(
                    *token.canister_id().ok_or("ICRC3: Invalid principal id for get_transactions")?,
                    "get_transactions",
                    (args,),
                )
                .await
                {
                    Ok(response_tuple) => {
                        let response = response_tuple.0;
                        if response.transactions.is_empty() {
                            return Err(format!(
                                "ICRC3 verify_block_id for {}: No transaction found at index {}",
                                token.symbol(),
                                block_id
                            ));
                        }
                        for tx_data in response.transactions.into_iter() {
                            // Assuming the first transaction is the one we care about.
                            if tx_data.timestamp < general_tx_min_valid_timestamp {
                                return Err(format!(
                                    "ICRC3 verify_block_id for {}: Transaction timestamp expired",
                                    token.symbol()
                                ));
                            }

                            match transaction_type {
                                TransactionType::Transfer | TransactionType::TransferFrom => {
                                    if let Some(transfer) = tx_data.transfer {
                                        if transfer.from != current_caller_account {
                                            return Err("ICRC3 Transfer: 'from' mismatch".to_string());
                                        }
                                        if transfer.to != kong_backend_account {
                                            return Err("ICRC3 Transfer: 'to' mismatch".to_string());
                                        }
                                        if transfer.amount != *amount {
                                            return Err(format!(
                                                "ICRC3 Transfer: amount mismatch (rec: {:?}, exp: {:?})",
                                                transfer.amount, amount
                                            ));
                                        }

                                        if *transaction_type == TransactionType::TransferFrom {
                                            match transfer.spender {
                                                Some(s) if s == kong_backend_account => (), // Correct spender
                                                Some(_) => return Err("ICRC3 TransferFrom: spender mismatch".to_string()),
                                                None => return Err("ICRC3 TransferFrom: missing spender".to_string()),
                                            }
                                        } else {
                                            // Simple Transfer
                                            if transfer.spender.is_some() {
                                                return Err("ICRC3 Transfer: unexpected spender".to_string());
                                            }
                                        }
                                        return Ok(());
                                    }
                                }
                                TransactionType::Approve => {
                                    if let Some(approve) = tx_data.approve {
                                        if approve.from != current_caller_account {
                                            return Err("ICRC3 Approve: 'from' mismatch".to_string());
                                        }
                                        if approve.spender != kong_backend_account {
                                            return Err("ICRC3 Approve: 'spender' mismatch".to_string());
                                        }
                                        if approve.amount < *amount {
                                            return Err(format!(
                                                "ICRC3 Approve: insufficient amount (appr: {:?}, req: {:?})",
                                                approve.amount, amount
                                            ));
                                        }

                                        if let Some(ledger_expires_at) = approve.expires_at {
                                            if ledger_expires_at < get_time() {
                                                // Must not be expired now
                                                return Err("ICRC3 Approve: approval.expires_at is in the past".to_string());
                                            }
                                            if let Some(required_min_expiry_ts) = ts {
                                                // If caller requires it to be valid until a certain time
                                                if ledger_expires_at < required_min_expiry_ts {
                                                    return Err("ICRC3 Approve: approval.expires_at is before required ts".to_string());
                                                }
                                            }
                                        }
                                        // If approve.expires_at is None, it's non-expiring.
                                        // If ts is Some but approve.expires_at is None, this is usually fine.
                                        return Ok(());
                                    }
                                }
                            }
                        }
                        Err(format!(
                            "ICRC3 verify_block_id for {}: No matching transaction type found or verified at index {}",
                            token.symbol(),
                            block_id
                        ))
                    }
                    Err((rc, msg)) => Err(format!(
                        "ICRC3 verify_block_id for {}: get_transactions call failed: {:?} - {}",
                        token.symbol(),
                        rc,
                        msg
                    )),
                }
            }
            // ICP Ledger (ICRC1 style query_blocks)
            else if token.address_with_chain() == ICP_CANISTER_ID {
                let caller_icp_account_id = caller_account_id();
                let backend_icp_account_id = AccountIdentifier::new(
                    &kong_backend_account.owner,
                    &Subaccount(kong_backend_account.subaccount.unwrap_or_default()),
                );
                let expected_tokens_icp = Tokens::from_e8s(nat_to_u64(amount).ok_or_else(|| format!("ICP: Amount {:?} invalid", amount))?);
                let start_u64 = nat_to_u64(block_id).ok_or_else(|| format!("ICP: Block ID {:?} invalid", block_id))?;
                let args = GetBlocksArgs {
                    start: start_u64,
                    length: 1,
                };

                match query_blocks(*token.canister_id().ok_or("ICP: Invalid principal id")?, args).await {
                    Ok(query_response) => {
                        if query_response.blocks.is_empty() {
                            return Err(format!(
                                "ICP verify_block_id for {}: No block found at index {}",
                                token.symbol(),
                                start_u64
                            ));
                        }
                        for block_data in query_response.blocks.into_iter() {
                            if block_data.transaction.created_at_time.timestamp_nanos < general_tx_min_valid_timestamp {
                                return Err(format!("ICP verify_block_id for {}: Transaction timestamp expired", token.symbol()));
                            }
                            match (transaction_type, block_data.transaction.operation) {
                                (
                                    TransactionType::Approve,
                                    Some(Operation::Approve {
                                        from, spender, expires_at, ..
                                    }),
                                ) => {
                                    if from != caller_icp_account_id {
                                        return Err("ICP Approve: 'from' mismatch".to_string());
                                    }
                                    if spender != backend_icp_account_id {
                                        return Err("ICP Approve: 'spender' mismatch".to_string());
                                    }
                                    // ICP Approve op doesn't have 'amount'.
                                    if let Some(ledger_expires_at) = expires_at {
                                        if ledger_expires_at.timestamp_nanos < get_time() {
                                            return Err("ICP Approve: approval.expires_at is in the past".to_string());
                                        }
                                        if let Some(required_min_expiry_ts) = ts {
                                            if ledger_expires_at.timestamp_nanos < required_min_expiry_ts {
                                                return Err("ICP Approve: approval.expires_at is before required ts".to_string());
                                            }
                                        }
                                    }
                                    return Ok(());
                                }
                                (
                                    TransactionType::Transfer,
                                    Some(Operation::Transfer {
                                        from, to, amount: tx_amt, ..
                                    }),
                                )
                                | (
                                    TransactionType::TransferFrom,
                                    Some(Operation::Transfer {
                                        from, to, amount: tx_amt, ..
                                    }),
                                ) => {
                                    // ICP ledger Transfer op covers both user-initiated transfer and transfer_from if an approval was used.
                                    if from != caller_icp_account_id {
                                        return Err("ICP Transfer/From: 'from' mismatch".to_string());
                                    }
                                    if to != backend_icp_account_id {
                                        return Err("ICP Transfer/From: 'to' mismatch".to_string());
                                    }
                                    if tx_amt != expected_tokens_icp {
                                        return Err(format!(
                                            "ICP Transfer/From: amount mismatch (rec: {:?}, exp: {:?})",
                                            tx_amt, expected_tokens_icp
                                        ));
                                    }
                                    // For TransferFrom, ICP ledger block doesn't explicitly show spender.
                                    // This verification is thus simplified for TransferFrom on ICP.
                                    return Ok(());
                                }
                                // Explicit TransferFrom op is not expected to be directly verifiable this way in ICP ledger blocks for user actions.
                                (_, Some(Operation::TransferFrom { .. })) if *transaction_type == TransactionType::TransferFrom => {
                                    return Err("ICP: Direct 'TransferFrom' operation type in block is not typically verified this way; expect 'Transfer' op.".to_string());
                                }
                                _ => {} // Continue loop or fail after
                            }
                        }
                        Err(format!(
                            "ICP verify_block_id for {}: No matching transaction type found or verified at index {}",
                            token.symbol(),
                            start_u64
                        ))
                    }
                    Err((_rc, msg)) => Err(format!(
                        "ICP verify_block_id for {}: query_blocks call failed: {}",
                        token.symbol(),
                        msg
                    )),
                }
            }
            // Fallback for other IC tokens not handled above
            else {
                Err(format!(
                    "verify_block_id for {}: Token type not supported by this verification path (not ICRC3, not ICP)",
                    token.symbol()
                ))
            }
        }
        _ => Err("verify_block_id: Non-IC token category not supported".to_string()),
    }
}

#[allow(dead_code)]
pub async fn verify_allowance(
    token: &StableToken,
    amount: &Nat,
    owner_account: &Account,
    spender_account: &Account,
    required_valid_until_ts: Option<u64>,
) -> Result<(), String> {
    // Allowance check is usually for ICRC2+ tokens.
    let supports_icrc2 = match token {
        StableToken::IC(ic_token_data) => ic_token_data.icrc2, // Assuming ic_token_data has an icrc2: bool field
        _ => false,
    };
    if !supports_icrc2 {
        return Err(format!("Token {} does not support ICRC2 allowances.", token.symbol()));
    }

    let user_allowance = icrc2_allowance_call(owner_account, spender_account, token).await?;

    if user_allowance.allowance < *amount {
        return Err(format!(
            "Insufficient {} allowance for {}: has {}, requires {}",
            token.symbol(),
            owner_account.owner, // Or format full account
            user_allowance.allowance,
            amount
        ));
    }

    if let Some(ledger_expires_at_nanos) = user_allowance.expires_at {
        let current_time_nanos = get_time();
        if ledger_expires_at_nanos < current_time_nanos {
            return Err(format!(
                "Allowance for {} from {} to {} has expired (at {}ns).",
                token.symbol(),
                owner_account.owner,
                spender_account.owner,
                ledger_expires_at_nanos
            ));
        }
        // If the caller requires the allowance to be valid until a specific future time
        if let Some(required_ts_nanos) = required_valid_until_ts {
            if ledger_expires_at_nanos < required_ts_nanos {
                return Err(format!(
                    "Allowance for {} expires at {}ns, before required time of {}ns.",
                    token.symbol(),
                    ledger_expires_at_nanos,
                    required_ts_nanos
                ));
            }
        }
    }
    // If user_allowance.expires_at is None, it's a non-expiring allowance.
    // If required_valid_until_ts is Some, a non-expiring allowance is considered valid.
    Ok(())
}

// Renamed from icrc2_allowance to avoid confusion if used elsewhere, making it specific to this module's call.
async fn icrc2_allowance_call(owner_account: &Account, spender_account: &Account, token: &StableToken) -> Result<Allowance, String> {
    let allowance_args = AllowanceArgs {
        account: *owner_account,
        spender: *spender_account,
    };

    match ic_cdk::call::<(AllowanceArgs,), (Allowance,)>(
        *token
            .canister_id()
            .ok_or_else(|| format!("Invalid principal id for token {} in icrc2_allowance", token.symbol()))?,
        "icrc2_allowance",
        (allowance_args,),
    )
    .await
    {
        Ok(allowance_tuple) => Ok(allowance_tuple.0),
        Err((rc, msg)) => Err(format!(
            "Failed to get icrc2_allowance for token {}: {:?} - {}",
            token.symbol(),
            rc,
            msg
        )),
    }
}
