use anyhow::{Result, anyhow};
use candid::CandidType;
use candid::{Decode, Nat, Principal, encode_one};
use hex;
use ic_agent::Agent;
use icrc_ledger_types::icrc::generic_value::ICRC3Value;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc3::blocks::{GetBlocksRequest, GetBlocksResult, ICRC3GenericBlock};
use num_traits::cast::ToPrimitive;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

const TAGGR_CANISTER_ID: &str = "6qfxa-ryaaa-aaaai-qbhsq-cai";
const SUBACCOUNT_LENGTH: usize = 32; // 32 bytes for subaccount

// TAGGR specific GetBlocksArgs uses nat64 (u64) for both start and length.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct TaggrGetBlocksArgs {
    pub start: u64,
    pub length: u64,
}

#[derive(Debug)]
pub struct TransactionInfo {
    op: String,
    timestamp: u64,
    amount: Nat,
    from: Account,
    to: Option<Account>,
    spender: Option<Account>,
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
}

fn try_decode_account(icrc3_value_arr: &[ICRC3Value]) -> Option<Account> {
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
                blob.as_slice(), // Use as_slice() for clarity
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

pub fn process_icrc3_value(block: &ICRC3GenericBlock) -> Result<TransactionInfo> {
    if let ICRC3Value::Map(fields) = block {
        // Initialize all fields individually
        let mut op = None;
        let mut amount = None;
        let mut from = None;
        let mut to = None;
        let mut spender = None;
        let mut fee = None;
        let mut memo = None;

        // Process timestamp
        let timestamp = if let Some(ICRC3Value::Nat(ts)) = fields.get("ts") {
            ts.0.to_u64()
                .ok_or_else(|| anyhow!("Timestamp too large for u64: {}", ts))?
        } else {
            return Err(anyhow!("Timestamp not found in block"));
        };

        // Process operation type from fields
        if let Some(ICRC3Value::Text(op_text)) = fields.get("btype") {
            op = match op_text.as_str() {
                "1mint" => Some("mint".to_string()),
                "1burn" => Some("burn".to_string()),
                "1xfer" | "2xfer" => Some("xfer".to_string()), // 2xfer is icrc2_transfer_from
                _ => Some(op_text.clone()),
            };
        }

        // Process fee and memo from fields (for TAGGR and some operations)
        if let Some(ICRC3Value::Nat(fee_value)) = fields.get("fee") {
            fee = Some(fee_value.clone());
        }
        if let Some(ICRC3Value::Blob(memo_blob)) = fields.get("memo") {
            memo = Some(memo_blob.to_vec());
        }

        // Process transaction map
        if let Some(ICRC3Value::Map(tx)) = fields.get("tx") {
            // Operation type from transaction
            if let Some(ICRC3Value::Text(op_text)) = tx.get("op") {
                op = Some(op_text.clone());
            }

            // Amount
            if let Some(ICRC3Value::Nat(amount_value)) = tx.get("amt") {
                amount = Some(amount_value.clone());
            }

            // Fee and memo in tx map (for icrc2_transfer_from)
            if let Some(ICRC3Value::Nat(fee_value)) = tx.get("fee") {
                fee = Some(fee_value.clone());
            }
            if let Some(ICRC3Value::Blob(memo_blob)) = tx.get("memo") {
                memo = Some(memo_blob.to_vec());
            }

            // Account information
            if let Some(ICRC3Value::Array(from_arr)) = tx.get("from") {
                from = try_decode_account(from_arr);
            }

            if let Some(ICRC3Value::Array(to_arr)) = tx.get("to") {
                to = try_decode_account(to_arr);
            }

            if let Some(ICRC3Value::Array(spender_arr)) = tx.get("spender") {
                spender = try_decode_account(spender_arr);
            }
        }

        if op.is_none() {
            return Err(anyhow!("Operation type not found in block"));
        }
        if amount.is_none() {
            return Err(anyhow!("Amount not found in block"));
        }
        if from.is_none() {
            return Err(anyhow!("From account not found in block"));
        }

        // Construct and return TransactionInfo at the end
        return Ok(TransactionInfo {
            op: op.unwrap(),
            timestamp,
            amount: amount.unwrap(),
            from: from.unwrap(),
            to,
            spender,
            fee,
            memo,
        });
    }

    Err(anyhow!("Failed to find block"))
}

pub async fn icrc3_get_blocks(
    agent: &Agent,
    canister_id: &Principal,
    block_index: Nat,
) -> Result<GetBlocksResult> {
    let icrc3_get_blocks_args = match canister_id.to_text().as_str() {
        TAGGR_CANISTER_ID => encode_one(vec![TaggrGetBlocksArgs {
            start: block_index
                .0
                .to_u64()
                .ok_or_else(|| anyhow!("Failed to convert Nat to u64"))?,
            length: 1,
        }])?,
        _ => encode_one(vec![GetBlocksRequest {
            start: block_index,
            length: Nat::from(1u64),
        }])?,
    };
    let response = agent
        .query(canister_id, "icrc3_get_blocks")
        .with_arg(icrc3_get_blocks_args)
        .await?;
    let blocks = Decode!(&response.as_slice(), GetBlocksResult)?;

    for block in blocks.blocks.iter() {
        println!("----------------------------------------");
        println!("Processing Block ID: {}", block.id);
        let tx_info = process_icrc3_value(&block.block)?;
        println!("  Type: {}", tx_info.op);
        println!("  Timestamp: {}", tx_info.timestamp);
        print!("  From: {}", tx_info.from.owner);
        if let Some(sub) = tx_info.from.subaccount {
            println!(" (Subaccount: {})", hex::encode(sub));
        } else {
            println!(" (Default Subaccount)");
        }
        if let Some(to_acc) = tx_info.to {
            print!("  To:   {}", to_acc.owner);
            if let Some(sub) = to_acc.subaccount {
                println!(" (Subaccount: {})", hex::encode(sub));
            } else {
                println!(" (Default Subaccount)");
            }
        }
        if let Some(spender_acc) = tx_info.spender {
            print!("  Spender:   {}", spender_acc.owner);
            if let Some(sub) = spender_acc.subaccount {
                println!(" (Subaccount: {})", hex::encode(sub));
            } else {
                println!(" (Default Subaccount)");
            }
        }
        println!("  Amount: {}", tx_info.amount);
        if let Some(fee) = tx_info.fee {
            println!("  Fee: {}", fee);
        }
        if let Some(memo) = tx_info.memo {
            println!("  Memo: {:?}", hex::encode(memo)); // Or potentially try_into::<String>().unwrap_or_else(|_| hex::encode(&memo))
        } else {
            println!("  Memo: None");
        }
        println!("----------------------------------------");
    }

    Ok(blocks)
}
