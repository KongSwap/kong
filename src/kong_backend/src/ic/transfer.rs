use candid::Nat;
use ic_ledger_types::{transfer, AccountIdentifier, Memo, Timestamp, Tokens, TransferArgs, DEFAULT_FEE};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};

use crate::helpers::nat_helpers::{nat_is_zero, nat_to_u64, nat_zero};
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;

// ICP transfer using account id
// icp_transfer is used for all transfers from backend canister to user's wallet
pub async fn icp_transfer(
    amount: &Nat,
    to_account_id: &AccountIdentifier,
    token: &StableToken,
    created_at_time: Option<&Timestamp>,
) -> Result<Nat, String> {
    if nat_is_zero(amount) {
        // if amount = 0, return Ok(block_id = 0) to return success. Don't error Err as it could be put into claims
        return Ok(nat_zero());
    }
    let amount = Tokens::from_e8s(nat_to_u64(amount).ok_or("Invalid transfer amount")?);

    let transfer_args = TransferArgs {
        memo: Memo(0),
        amount,
        from_subaccount: None,
        fee: DEFAULT_FEE,
        to: *to_account_id,
        created_at_time: created_at_time.cloned(),
    };

    match transfer(*token.canister_id().ok_or("Invalid principal id")?, transfer_args)
        .await
        .map_err(|e| e.1)?
    {
        Ok(block_id) => Ok(Nat::from(block_id)),
        Err(e) => Err(e.to_string())?,
    }
}

/// Transfers ICRC1 tokens from the backend canister to a user's wallet.
///
/// # Arguments
///
/// * `amount` - The amount of tokens to transfer.
/// * `to_principal_id` - The principal ID of the recipient.
/// * `token` - The stable token to transfer.
/// * `created_at_time` - The optional timestamp of the transfer.
///
/// # Returns
///
/// * `Ok(Nat)` - The block ID of the transfer if successful.
/// * `Err(String)` - An error message if the transfer fails.
pub async fn icrc1_transfer(
    amount: &Nat,
    to_principal_id: &Account,
    token: &StableToken,
    created_at_time: Option<u64>,
) -> Result<Nat, String> {
    if nat_is_zero(amount) {
        // if amount = 0, return Ok(block_id = 0) to return success. Don't error Err as it could be put into claims
        return Ok(nat_zero());
    }
    let id = *token.canister_id().ok_or("Invalid principal id")?;

    let transfer_args: TransferArg = TransferArg {
        memo: None,
        amount: amount.clone(),
        from_subaccount: None,
        fee: None,
        to: *to_principal_id,
        created_at_time,
    };

    match ic_cdk::call::<(TransferArg,), (Result<Nat, TransferError>,)>(id, "icrc1_transfer", (transfer_args,))
        .await
        .map_err(|e| e.1)?
        // Access the first element of the tuple, which is the `Result<BlockIndex, TransferError>`, for further processing.
        .0
    {
        Ok(block_id) => Ok(block_id),
        Err(e) => Err(e.to_string())?,
    }
}

// icrc2_transfer_from using principal id's where from_principal_id has issued an icrc2_approve
pub async fn icrc2_transfer_from(
    token: &StableToken,
    amount: &Nat,
    from_principal_id: &Account,
    to_principal_id: &Account,
) -> Result<Nat, String> {
    if !token.is_icrc2() {
        return Err("Token does not support ICRC2".to_string());
    }
    if nat_is_zero(amount) {
        return Err("Transfer_from amount is zero".to_string());
    }
    let id = *token.canister_id().ok_or("Invalid principal id")?;

    let transfer_from_args = TransferFromArgs {
        spender_subaccount: None,
        from: *from_principal_id,
        to: *to_principal_id,
        amount: amount.clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let block_id =
        match ic_cdk::call::<(TransferFromArgs,), (Result<Nat, TransferFromError>,)>(id, "icrc2_transfer_from", (transfer_from_args,))
            .await
            .map_err(|e| e.1)?
            .0
        {
            Ok(block_id) => block_id,
            Err(e) => Err(e.to_string())?,
        };
    Ok(block_id)
}
