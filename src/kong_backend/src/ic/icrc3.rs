use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc::generic_value::ICRC3Value;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc3::blocks::{GetBlocksRequest, GetBlocksResult, ICRC3GenericBlock};
use icrc_ledger_types::icrc3::transactions::{GetTransactionsRequest, GetTransactionsResponse};
use num_traits::cast::ToPrimitive;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::helpers::nat_helpers::nat_to_u64;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;

const SUBACCOUNT_LENGTH: usize = 32;

/// Used by verification helper functions to determine if a fallback should be attempted.
#[derive(Debug)]
pub enum VerificationError {
    Hard(String), // A definitive validation failure for the transaction. Stop.
    Soft(String), // Method failed (e.g., call error, block not found by this method). Try fallback.
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct TaggrGetBlocksArgs {
    pub start: u64,
    pub length: u64,
}

#[derive(Debug)]
pub struct ParsedICRC3TransactionInfo {
    pub op: String,
    pub timestamp: u64,
    pub amount: Nat,
    pub from: Account,
    pub to: Option<Account>,
    pub spender: Option<Account>,
}

pub fn try_decode_icrc3_account_value(icrc3_value_arr: &[ICRC3Value]) -> Option<Account> {
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

pub fn process_icrc3_generic_block_value(block_value: &ICRC3GenericBlock) -> Result<ParsedICRC3TransactionInfo, String> {
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
#[allow(clippy::too_many_arguments)]
pub fn verify_parsed_transfer_details(
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
pub async fn attempt_icrc3_get_blocks_verification(
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

    let blocks_result_tuple: Result<(GetBlocksResult,), _> = if token_address_chain == "IC.6qfxa-ryaaa-aaaai-qbhsq-cai" { // TAGGR_CANISTER_ID 
        let args = vec![TaggrGetBlocksArgs {
            start: nat_to_u64(block_id_arg)
                .ok_or_else(|| VerificationError::Soft(format!("TAGGR ICRC3: Block ID {:?} not u64", block_id_arg)))?,
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

pub async fn attempt_generic_get_transactions_verification(
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