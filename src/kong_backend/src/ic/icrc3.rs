use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc::generic_value::ICRC3Value;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc3::blocks::ICRC3GenericBlock; // GetBlocksRequest, GetBlocksResult removed
use icrc_ledger_types::icrc3::transactions::{GetTransactionsRequest, GetTransactionsResponse};
use num_traits::cast::ToPrimitive;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

// nat_to_u64 import removed
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;

const SUBACCOUNT_LENGTH: usize = 32;

// VerificationError enum removed as per Jon's suggestion

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

pub async fn attempt_generic_get_transactions_verification(
    token: &StableToken,
    transaction_start_index_arg: &Nat, // block_id is used as start index here
    expected_amount_arg: &Nat,
    current_caller_account: &Account,
    kong_backend_account: &Account,
    min_valid_timestamp: u64,
) -> Result<(), String> { // Changed return type
    let canister_id = *token
        .canister_id()
        .ok_or_else(|| "Token missing canister_id for get_transactions".to_string())?; // Now returns String
    let args = GetTransactionsRequest {
        start: transaction_start_index_arg.clone(),
        length: Nat::from(1u32),
    };

    match ic_cdk::call::<(GetTransactionsRequest,), (GetTransactionsResponse,)>(canister_id, "get_transactions", (args,)).await {
        Ok(get_transactions_response_tuple) => {
            let response: GetTransactionsResponse = get_transactions_response_tuple.0;
            if response.transactions.is_empty() {
                return Err(format!( // Now returns String
                    "GetTransactions for {}: No transactions returned for start_index {}",
                    token.symbol(),
                    transaction_start_index_arg
                ));
            }
            for tx in response.transactions.into_iter() {
                if let Some(transfer_details) = tx.transfer {
                    // verify_parsed_transfer_details already returns Result<(), String>
                    // If it's Err(reason), that reason will be propagated.
                    verify_parsed_transfer_details(
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
                    )?; // This will propagate the String error if verify_parsed_transfer_details fails
                    return Ok(()); // Success!
                }
            }
            Err(format!( // Now returns String
                "GetTransactions for {}: Transfer verification conditions not met for start_index {}",
                token.symbol(),
                transaction_start_index_arg
            ))
        }
        Err((rc, msg)) => Err(format!( // Now returns String
            "GetTransactions call failed for {}: {:?} - {}",
            token.symbol(),
            rc,
            msg
        )),
    }
}
