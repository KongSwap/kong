use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api::call;
use serde::Serialize;

use crate::types::TokenAmount;
use crate::controllers::admin::get_minter_account_from_storage;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use crate::token::registry::{TokenIdentifier, get_token_info, is_supported_token};

/// Error types for token transfers
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum TokenTransferError {
    TransferFailure(String),
    TransferError(String),    // Added for handling ICRC1 transfer errors
    CallError(String),       // Added for handling IC call errors
    UnsupportedToken(String),
    InvalidAmount,
    CallerNotAuthenticated,
    InternalError(String),
    InsufficientFunds,       // Added for handling cases where amount is less than fee
}

/// Transfer tokens from the caller to a recipient
pub async fn transfer_token(
    recipient: Principal,
    amount: TokenAmount,
    token_id: &TokenIdentifier,
    custom_fee: Option<TokenAmount> // Add optional custom fee parameter
) -> Result<candid::Nat, TokenTransferError> {
    // Verify the token is supported
    if !is_supported_token(token_id) {
        return Err(TokenTransferError::UnsupportedToken(
            format!("Token {} is not supported", token_id)
        ));
    }

    // Get token info for transfer
    let token_info = get_token_info(token_id)
        .ok_or(TokenTransferError::UnsupportedToken(
            format!("Token {} info not found", token_id)
        ))?;

    // Prepare transfer arguments
    let fee = match custom_fee {
        Some(fee) => fee.clone().into(), // Use custom fee if provided
        None => token_info.transfer_fee.clone().into() // Use default token fee otherwise
    };
    
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: recipient,
            subaccount: None,
        },
        amount: amount.clone().into(), // Convert StorableNat to Nat
        fee: Some(fee), // Use the selected fee
        memo: None,
        created_at_time: None,
    };

    // Call the token canister to execute transfer
    let token_canister = Principal::from_text(token_id)
        .map_err(|e| TokenTransferError::InternalError(
            format!("Invalid token principal: {}", e)
        ))?;

    // Make the transfer call
    match call::call::<(TransferArg,), (Result<candid::Nat, TransferError>,)>(token_canister, "icrc1_transfer", (transfer_args,)).await {
        Ok((Ok(block_index),)) => {
            ic_cdk::println!("Transfer successful with transaction ID: {}", block_index);
            Ok(block_index)
        },
        Ok((Err(e),)) => Err(TokenTransferError::TransferError(
            format!("Transfer failed: {:?}", e)
        )),
        Err((code, message)) => Err(TokenTransferError::CallError(
            format!("Transfer call failed: {:?} - {}", code, message)
        )),
    }
}

/// Handle fee transfers based on token type
pub async fn handle_fee_transfer(
    fee_amount: TokenAmount,
    token_id: &TokenIdentifier
) -> Result<Option<candid::Nat>, TokenTransferError> {
    // Check if token is supported
    let token_info = get_token_info(token_id)
        .ok_or(TokenTransferError::UnsupportedToken(
            format!("Token {} is not supported", token_id)
        ))?;

    // For KONG, burn the tokens
    if token_info.is_kong {
        let block_index = burn_tokens(token_id, fee_amount).await?;
        Ok(Some(block_index))
    } else {
        // For other tokens, transfer to the minter account
        let minter_account = get_minter_account_from_storage();
        let block_index = transfer_token(minter_account, fee_amount, token_id, None).await?;
        Ok(Some(block_index))
    }
}

/// Burn tokens (only applicable for KONG)
pub async fn burn_tokens(
    token_id: &TokenIdentifier,
    amount: TokenAmount
) -> Result<candid::Nat, TokenTransferError> {
    // Check if token is KONG
    let token_info = get_token_info(token_id)
        .ok_or(TokenTransferError::UnsupportedToken(
            format!("Token {} is not supported", token_id)
        ))?;

    if !token_info.is_kong {
        // For non-KONG tokens, transfer to the minter account instead of burning
        let minter_account = get_minter_account_from_storage();
        
        // Deduct the transfer fee from the amount to avoid the canister paying it twice
        let transfer_fee = token_info.transfer_fee.clone();
        let amount_clone = amount.clone(); // Clone amount before using it in operations
        let adjusted_amount = if amount_clone > transfer_fee {
            amount_clone - transfer_fee
        } else {
            ic_cdk::println!("Amount to burn {} is less than transfer fee {}, skipping", 
                          amount.to_u64(), transfer_fee.to_u64());
            return Err(TokenTransferError::InsufficientFunds);
        };
        
        ic_cdk::println!("Burning tokens by transferring {} to minter (original amount: {})", 
                       adjusted_amount.to_u64(), amount.to_u64());
        return transfer_token(minter_account, adjusted_amount, token_id, None).await;
    }

    // Get the burn address for KONG (use the minter addresses defined in transfer_kong.rs)
    let kong_ledger_id = crate::KONG_LEDGER_ID;
    let minter_address = if kong_ledger_id == "o7oak-iyaaa-aaaaq-aadzq-cai" {
        // Production environment
        crate::resolution::transfer_kong::KONG_MINTER_PRINCIPAL_PROD
    } else {
        // Local or test environment
        crate::resolution::transfer_kong::KONG_MINTER_PRINCIPAL_LOCAL
    };
    
    ic_cdk::println!("Using minter address for burning: {}", minter_address);
    
    // Parse the minter principal
    let burn_address = Principal::from_text(minter_address)
        .map_err(|e| TokenTransferError::InternalError(
            format!("Failed to parse burn address: {}", e)
        ))?;

    // Transfer to the burn address (minter) with zero fee
    let zero_fee = Some(TokenAmount::from(0u64));
    let block_index = transfer_token(burn_address, amount, token_id, zero_fee).await?;
    ic_cdk::println!("Burned tokens with transaction ID: {}", block_index);
    Ok(block_index)
}

/// Calculate the amount after platform fee
pub fn calculate_amount_after_fee(
    amount: &TokenAmount,
    token_id: &TokenIdentifier
) -> TokenAmount {
    let token_info = match get_token_info(token_id) {
        Some(info) => info,
        None => return amount.clone(), // If token not found, no fee
    };

    let fee_percentage = token_info.fee_percentage;
    let amount_u64 = amount.to_u64();
    let fee_amount = amount_u64 * fee_percentage / 10000; // fee_percentage is in basis points (100 = 1%)
    
    TokenAmount::from(amount_u64 - fee_amount)
}
