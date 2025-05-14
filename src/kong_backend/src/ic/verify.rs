use candid::Nat;
use ic_ledger_types::{query_blocks, AccountIdentifier, Block, GetBlocksArgs, Operation, Subaccount, Tokens};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::allowance::{Allowance, AllowanceArgs};
use icrc_ledger_types::icrc3::transactions::{GetTransactionsRequest, GetTransactionsResponse};
use icrc_ledger_types::icrc3::blocks::{GetBlocksRequest as ICRC3GetBlocksRequest, GetBlocksResult as ICRC3GetBlocksResult}; // ICRC3GenericBlock removed

// ICRC3Value import removed

use super::icrc3; // Keep for process_icrc3_generic_block_value and verify_parsed_transfer_details
// No longer need VerificationError as ICRC3VerificationError if it's fully removed later
use super::wumbo::Transaction1;

use crate::helpers::nat_helpers::nat_to_u64;
use crate::ic::icrc3::TaggrGetBlocksArgs; // ParsedICRC3TransactionInfo removed
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
const TAGGR_CANISTER_ID: &str = "IC.6qfxa-ryaaa-aaaai-qbhsq-cai"; // Added from icrc3.rs for inlined logic


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
            if ic_token.icrc3 {
                // Inlined logic from attempt_icrc3_get_blocks_verification
                // This async block attempts verification. Ok(()) means success for verify_transfer.
                // Err(reason) means this ICRC3 path failed, and verify_transfer should fall back.
                let icrc3_get_blocks_verification_result: Result<(), String> = (async {
                    let kong_settings = kong_settings_map::get();
                    let min_valid_timestamp = get_time() - kong_settings.transfer_expiry_nanosecs;
                    let current_caller_account = caller_id(); // ICRC-1 Account of the caller
                    let kong_backend_account = &kong_settings.kong_backend; // ICRC-1 Account for Kong backend

                    let canister_id_principal = match token.canister_id() {
                        Some(id) => id,
                        None => return Err("Token missing canister_id for icrc3_get_blocks".to_string()),
                    };
                    let token_address_chain = token.address_with_chain();

                    let blocks_result_tuple: Result<(ICRC3GetBlocksResult,), _> = 
                        if token_address_chain == TAGGR_CANISTER_ID { 
                            let start_u64 = nat_to_u64(block_id)
                                .ok_or_else(|| format!("TAGGR ICRC3: Block ID {:?} not convertible to u64", block_id))?;
                            let args = vec![TaggrGetBlocksArgs { start: start_u64, length: 1 }];
                            ic_cdk::call(*canister_id_principal, "icrc3_get_blocks", (args,)).await
                        } else {
                            let args = ICRC3GetBlocksRequest { start: block_id.clone(), length: Nat::from(1u32) };
                            ic_cdk::call(*canister_id_principal, "icrc3_get_blocks", (args,)).await
                        };

                    match blocks_result_tuple {
                        Ok(get_blocks_response_tuple) => {
                            let blocks_data = get_blocks_response_tuple.0;
                            if blocks_data.blocks.is_empty() {
                                return Err(format!(
                                    "ICRC3 get_blocks for {}: No blocks returned for block_id {}",
                                    token.symbol(), block_id
                                ));
                            }

                            for block_envelope in blocks_data.blocks.iter() {
                                if block_envelope.id != *block_id { 
                                    // Log if needed: "Skipping block with id {} (expected {})"
                                    continue; 
                                }

                                match icrc3::process_icrc3_generic_block_value(&block_envelope.block) {
                                    Ok(tx_info) => {
                                        if matches!(tx_info.op.as_str(), "icrc1_transfer" | "1xfer" | "transfer" | "xfer") {
                                            // verify_parsed_transfer_details returns Result<(), String>
                                            // If Err, it propagates out of this async block.
                                            icrc3::verify_parsed_transfer_details(
                                                &tx_info.from,
                                                tx_info.to.as_ref(),
                                                tx_info.spender.as_ref(),
                                                &tx_info.amount,
                                                tx_info.timestamp,
                                                &current_caller_account,
                                                kong_backend_account,
                                                amount, // This is the `amount` arg of `verify_transfer`
                                                min_valid_timestamp,
                                                "ICRC3 GetBlocks (Inlined)",
                                            )?; 
                                            return Ok(()); // Success for this ICRC3 path!
                                        }
                                        // If op type doesn't match, this block isn't a verifiable transfer.
                                        // Continue loop in case other blocks were (unexpectedly) returned.
                                    }
                                    Err(parse_err) => {
                                        // Block parsing failed.
                                        return Err(format!(
                                            "ICRC3 get_blocks for {}: Failed to parse block {}: {}",
                                            token.symbol(), block_id, parse_err
                                        ));
                                    }
                                }
                            }
                            // If loop finishes, no block with matching ID led to successful verification.
                            Err(format!(
                                "ICRC3 get_blocks for {}: Transfer verification conditions not met for block_id {} (block found but details mismatch or not a transfer)",
                                token.symbol(), block_id
                            ))
                        }
                        Err((rejection_code, msg)) => Err(format!(
                            "ICRC3 get_blocks call failed for {}: {:?} - {}",
                            token.symbol(), rejection_code, msg
                        )),
                    }
                }).await;

                if icrc3_get_blocks_verification_result.is_ok() {
                    return Ok(()); // ICRC3 get_blocks path succeeded, verification complete.
                } else {
                    // ICRC3 get_blocks path failed. Log the error if desired.
                    // e.g., ic_cdk::println!("ICRC3 get_blocks verification failed: {}", icrc3_get_blocks_verification_result.unwrap_err());
                    // Proceed to fallback traditional verification methods.
                }
            }

            // If not ICRC3, or if ICRC3 verification failed (softly, now always the case), use traditional methods
            let token_address_with_chain = token.address_with_chain();
            // ts_start needs to be defined here for the fallback logic
            let ts_start = get_time() - kong_settings_map::get().transfer_expiry_nanosecs; 

            if token_address_with_chain == ICP_CANISTER_ID {
                // use query_blocks
                let block_args = GetBlocksArgs {
                    start: nat_to_u64(block_id).ok_or_else(|| format!("ICP ledger block id {:?} not found", block_id))?,
                    length: 1,
                };
                match query_blocks(*token.canister_id().ok_or("Invalid principal id")?, block_args).await {
                    Ok(query_response) => {
                        let blocks: Vec<Block> = query_response.blocks;
                        let backend_account = kong_settings_map::get().kong_backend;
                        let backend_account_id =
                            AccountIdentifier::new(&backend_account.owner, &Subaccount(backend_account.subaccount.unwrap_or([0; 32])));
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
            } else if token_address_with_chain == WUMBO_CANISTER_ID
                || token_address_with_chain == DAMONIC_CANISTER_ID
                || token_address_with_chain == CLOWN_CANISTER_ID
            {
                // use get_transaction()
                match ic_cdk::call::<(Nat,), (Option<Transaction1>,)>(
                    *token.canister_id().ok_or("Invalid principal id")?,
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
                                    if from != caller_id() {
                                        Err("Transfer from does not match caller")?
                                    }
                                    let to = transfer.to;
                                    if to != kong_settings_map::get().kong_backend {
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
                    *token.canister_id().ok_or("Invalid principal id")?,
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
                                if from != caller_id() {
                                    Err("Transfer from does not match caller")?
                                }
                                let to = transfer.to;
                                if to != kong_settings_map::get().kong_backend {
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
