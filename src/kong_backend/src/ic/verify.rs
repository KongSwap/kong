use candid::Nat;
use ic_ledger_types::{query_blocks, AccountIdentifier, Block, GetBlocksArgs, Operation, Subaccount, Tokens};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::allowance::{Allowance, AllowanceArgs};
use icrc_ledger_types::icrc3::transactions::{GetTransactionsRequest, GetTransactionsResponse};

use super::wumbo::Transaction1;

use crate::helpers::nat_helpers::nat_to_u64;
use crate::ic::get_time::get_time;
use crate::ic::id::{caller_account_id, caller_id};
use crate::stable_kong_settings::kong_settings;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;

#[cfg(not(feature = "prod"))]
const ICP_CANISTER_ID: &str = "IC.nppha-riaaa-aaaal-ajf2q-cai";
#[cfg(feature = "prod")]
const ICP_CANISTER_ID: &str = "IC.ryjl3-tyaaa-aaaaa-aaaba-cai";
const WUMBO_CANISTER_ID: &str = "IC.wkv3f-iiaaa-aaaap-ag73a-cai";
const DAMONIC_CANISTER_ID: &str = "IC.zzsnb-aaaaa-aaaap-ag66q-cai";
const CLOWN_CANISTER_ID: &str = "IC.iwv6l-6iaaa-aaaal-ajjjq-cai";

/// Represents the type of a transaction.
#[derive(Debug, PartialEq, Eq)]
pub enum TransactionType {
    Approve,
    Transfer,
    TransferFrom,
}

/// verify that the block_id is a transfer from caller, amount matches
/// ts_start timestamp where transfer must be after this time
pub async fn verify_transfer(token: &StableToken, block_id: &Nat, amount: &Nat) -> Result<(), String> {
    let token_address_with_chain = token.address_with_chain();
    let ts_start = get_time() - kong_settings::get().transfer_expiry_nanosecs; // only accept transfers within the hour
    match token {
        StableToken::IC(_) => {
            if token_address_with_chain == ICP_CANISTER_ID {
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
                        let backend_account = kong_settings::get().kong_backend_account;
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

                        Err(format!("Failed to verify {} transfer block id {}", token.symbol(), block_id))?
                    }
                    Err(e) => Err(e)?,
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
                                    if to != kong_settings::get().kong_backend_account {
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
                    Err(e) => Err(e.1)?,
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
                                if to != kong_settings::get().kong_backend_account {
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
                            } else if let Some(burn) = transaction.burn {
                                // burn for LP token with remove liquidity
                                let from = burn.from;
                                if from != caller_id() {
                                    Err("Burn does not match caller")?
                                }
                                // burns have to be back to the backend canister
                                // make sure spender is None so not an icrc2_transfer_from transaction
                                let spender = burn.spender;
                                if spender.is_some() {
                                    Err("Invalid burn spender")?
                                }
                                let burn_amount = burn.amount;
                                if burn_amount != *amount {
                                    Err(format!("Invalid burn amount: rec {:?} exp {:?}", burn_amount, amount))?
                                }
                                let timestamp = transaction.timestamp;
                                if timestamp < ts_start {
                                    Err("Expired burn timestamp")?
                                }
                                return Ok(()); // success
                            } else if let Some(_mint) = transaction.mint {
                                // not used
                            } else if let Some(_approve) = transaction.approve {
                                // not used
                            } else {
                                Err(format!("Invalid transaction kind: {}", transaction.kind))?
                            }
                        }

                        Err(format!("Failed to verify {} transfer block id {}", token.symbol(), block_id))?
                    }
                    Err(e) => Err(e.1)?,
                }
            }
        }
        _ => Err("Verify transfer not supported for this token")?,
    }
}

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
                            } else if let Some(burn) = transaction.burn {
                                // when burning LP tokens
                                let from = burn.from;
                                let spender = burn.spender;
                                let burn_amount = burn.amount;
                                if from != caller_id() {
                                    Err("Burn from does not match caller")?
                                }
                                if let Some(spender) = spender {
                                    if spender != kong_settings::get().kong_backend_account {
                                        Err("Burn spender does not match Kong backend")?
                                    }
                                } else {
                                    Err("Missing burn spender")?
                                }
                                if burn_amount != *amount {
                                    Err(format!("Invalid burn amount: rec {:?} exp {:?}", burn_amount, amount))?
                                }
                                return Ok(()); // success
                            } else if let Some(transfer) = transaction.transfer {
                                if *transaction_type == TransactionType::Transfer || *transaction_type == TransactionType::TransferFrom {
                                    let from = transfer.from;
                                    let to = transfer.to;
                                    let spender = transfer.spender;
                                    let transfer_amount = transfer.amount;
                                    if from != caller_id() {
                                        Err("Transfer from does not match caller")?
                                    }
                                    if to != kong_settings::get().kong_backend_account {
                                        Err("Transfer to does not match Kong backend")?
                                    }
                                    if *transaction_type == TransactionType::TransferFrom {
                                        if let Some(spender) = spender {
                                            if spender != kong_settings::get().kong_backend_account {
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
                                    if spender != kong_settings::get().kong_backend_account {
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
                        let backend_account = kong_settings::get().kong_backend_account;
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
