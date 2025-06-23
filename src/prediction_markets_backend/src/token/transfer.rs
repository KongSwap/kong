//! # Token Transfer Module
//!
//! This module handles all token transfer operations for the Kong Swap prediction markets platform.
//! It provides a unified interface for transferring different token types (KONG, ICP, etc.) while
//! handling the specific requirements and error conditions of each token standard.
//!
//! ## Key Features
//!
//! - **Multi-token Support**: Transfers for ICRC-1 compliant tokens with proper error handling
//! - **Fee Management**: Handling of transfer fees with custom fee options
//! - **Error Classification**: Categorization of errors as retryable or permanent
//! - **Token Burning**: Special handling for burning KONG tokens during fee collection
//!
//! The module is designed to be resilient against temporary failures in the distributed
//! Internet Computer environment, with comprehensive retry logic and error reporting.

use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api::call;
use serde::Serialize;

use crate::controllers::admin::get_minter_account_from_storage;
use crate::token::registry::{get_supported_token_identifiers, get_token_info, is_supported_token, TokenIdentifier, TokenInfo};
use crate::types::TokenAmount;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

/// Error types for token transfers
///
/// This comprehensive error enum categorizes all possible failure modes
/// when transferring tokens. It distinguishes between retryable errors
/// (which may succeed on a subsequent attempt) and permanent errors
/// (which require intervention to resolve).
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum TokenTransferError {
    /// Generic transfer failure with details
    TransferFailure(String),

    /// Specific ICRC1 token standard transfer errors
    TransferError(String),

    /// Errors from the IC call mechanism
    CallError(String),

    /// Attempted transfer with an unsupported token type
    UnsupportedToken(String),

    /// Transfer amount is invalid (e.g., negative or zero)
    InvalidAmount,

    /// Authentication error (caller not authorized)
    CallerNotAuthenticated,

    /// Internal system error unrelated to the token
    InternalError(String),

    /// Insufficient funds to complete the transfer (including fees)
    InsufficientFunds,

    /// Temporary error that might succeed on retry
    RetryableError(String),

    /// Permanent error that requires intervention to fix
    PermanentError(String),

    /// Explicit rejection from the token ledger canister
    LedgerRejection(String),

    /// Network or communication failures
    NetworkError(String),

    /// Errors specific to a particular token's implementation
    TokenSpecificError(String),

    /// Error specific to fee exraction
    FeeError(String),
}

/// Helper methods for TokenTransferError
impl TokenTransferError {
    /// Determines if the error is potentially recoverable through retrying
    ///
    /// This method identifies error types that may be resolved by simply
    /// retrying the operation later, such as network errors or temporary
    /// unavailability. It's used by recovery systems to determine which
    /// failed transactions should be automatically retried.
    ///
    /// # Returns
    /// * `bool` - True if the error might be resolved by retrying
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            // Some call errors might be retryable
            TokenTransferError::RetryableError(_) | TokenTransferError::NetworkError(_) | TokenTransferError::CallError(_)
        )
    }

    /// Returns a detailed error message suitable for logging and diagnostics
    ///
    /// This method generates human-readable error messages that include
    /// both the error category and specific details. These messages are
    /// used for logging, transaction recovery records, and administrative
    /// troubleshooting.
    ///
    /// # Returns
    /// * `String` - Formatted error message with detailed information
    pub fn detailed_message(&self) -> String {
        match self {
            TokenTransferError::TransferFailure(msg) => format!("Transfer failed: {}", msg),
            TokenTransferError::TransferError(msg) => format!("Token transfer error: {}", msg),
            TokenTransferError::CallError(msg) => format!("Canister call error: {}", msg),
            TokenTransferError::UnsupportedToken(msg) => format!("Unsupported token: {}", msg),
            TokenTransferError::InvalidAmount => "Invalid amount specified for transfer".to_string(),
            TokenTransferError::CallerNotAuthenticated => "Caller not authenticated".to_string(),
            TokenTransferError::InternalError(msg) => format!("Internal error: {}", msg),
            TokenTransferError::InsufficientFunds => "Insufficient funds to complete transfer".to_string(),
            TokenTransferError::RetryableError(msg) => format!("Temporary error (can retry): {}", msg),
            TokenTransferError::PermanentError(msg) => format!("Permanent error (cannot retry): {}", msg),
            TokenTransferError::LedgerRejection(msg) => format!("Ledger rejected transaction: {}", msg),
            TokenTransferError::NetworkError(msg) => format!("Network error: {}", msg),
            TokenTransferError::TokenSpecificError(msg) => format!("Token-specific error: {}", msg),
            TokenTransferError::FeeError(msg) => format!("Fee error: {}", msg),
        }
    }
}

async fn get_fees(token_id: &TokenIdentifier) -> Result<TokenAmount, TokenTransferError> {
    let token_canister =
        Principal::from_text(token_id).map_err(|e| TokenTransferError::InternalError(format!("Invalid token principal: {}", e)))?;

    match ic_cdk::call::<(), (candid::Nat,)>(token_canister, "icrc1_fee", ()).await {
        Ok(fee) => Ok(fee.0.into()),
        Err(e) => return Err(TokenTransferError::FeeError(e.1)),
    }
}

pub async fn transfer_token_fees_included(
    recipient: Principal,
    amount: TokenAmount,
    token_id: &TokenIdentifier,
) -> Result<candid::Nat, TokenTransferError> {
    let fee = get_fees(&token_id).await?;

    if amount < fee {
        return Err(TokenTransferError::TransferFailure(format!(
            "Transfer amount={} is less than fee={}",
            amount, fee
        )));
    }

    let amount = amount - fee.clone();

    transfer_token(recipient, amount, token_id, fee).await
}

/// Transfers tokens from the canister to a recipient
///
/// This function handles the transfer of any supported token type to the specified
/// recipient. It performs validation, constructs the appropriate transfer arguments,
/// and handles the response from the token ledger canister, including comprehensive
/// error handling and classification.
///
/// # Parameters
/// * `recipient` - Principal ID of the token recipient
/// * `amount` - Amount of tokens to transfer (must be greater than the transfer fee)
/// * `token_id` - Identifier of the token type to transfer
/// * `custom_fee` - Optional custom fee to use instead of the token's default fee
///
/// # Returns
/// * `Result<candid::Nat, TokenTransferError>` - On success, returns the block index
///   of the successful transfer. On failure, returns a categorized error.
///
/// # Error Handling
/// This function categorizes errors as either retryable or permanent, facilitating
/// automatic recovery through the transaction recovery system.
async fn transfer_token(
    recipient: Principal,
    amount: TokenAmount,
    token_id: &TokenIdentifier,
    fee: TokenAmount,
) -> Result<candid::Nat, TokenTransferError> {
    // Verify the token is supported with improved error message
    if !is_supported_token(token_id) {
        let supported_tokens = get_supported_token_identifiers();
        return Err(TokenTransferError::UnsupportedToken(format!(
            "Token {} is not supported. Supported tokens: {:?}",
            token_id, supported_tokens
        )));
    }

    // Get token info with improved error handling
    let token_info = match get_token_info(token_id) {
        Some(info) => info,
        None => {
            return Err(TokenTransferError::UnsupportedToken(format!(
                "Token {} info not found in registry",
                token_id
            )));
        }
    };

    // Validate amount is greater than fee
    if amount <= fee {
        return Err(TokenTransferError::InsufficientFunds);
    }

    let transfer_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: recipient,
            subaccount: None,
        },
        amount: amount.clone().into(), // Convert StorableNat to Nat
        fee: Some(fee.0),              // Use the selected fee
        memo: None,
        created_at_time: None,
    };

    // Call the token canister to execute transfer
    let token_canister =
        Principal::from_text(token_id).map_err(|e| TokenTransferError::InternalError(format!("Invalid token principal: {}", e)))?;

    // Improved logging with token symbol and amount in human-readable format
    ic_cdk::println!(
        "Preparing to transfer {} {} to {}",
        amount.to_u64() as f64 / 10f64.powf(token_info.decimals as f64),
        token_info.symbol,
        recipient.to_string()
    );

    // Make the transfer call with enhanced error handling
    // CRITICAL FIX: Properly handling the nested Result structure from ICRC-1 token transfers
    // The outer Result is from the IC call mechanism, the inner Result is from the token contract
    // Previously this was incorrectly typed as Result<(candid::Nat,), _> which caused payouts to fail
    match call::call::<(TransferArg,), (Result<candid::Nat, TransferError>,)>(token_canister, "icrc1_transfer", (transfer_args,)).await {
        // Successful call with successful transfer - both outer and inner Results are Ok
        Ok((Ok(block_index),)) => {
            ic_cdk::println!("Transfer successful with transaction ID: {}", block_index);
            Ok(block_index)
        }
        // Successful call but failed transfer - outer Result is Ok, inner Result is Err
        // This is the critical part that was fixed to properly handle nested Result structures
        // from ICRC-1 token transfers, previously causing payouts to fail
        Ok((Err(e),)) => {
            // Enhanced error categorization based on ICRC1 error type
            match e {
                TransferError::BadFee { expected_fee } => Err(TokenTransferError::TokenSpecificError(format!(
                    "Incorrect fee provided. Expected: {:?}",
                    expected_fee
                ))),
                TransferError::BadBurn { min_burn_amount } => Err(TokenTransferError::TokenSpecificError(format!(
                    "Insufficient burn amount. Minimum: {:?}",
                    min_burn_amount
                ))),
                TransferError::InsufficientFunds { balance: _ } => Err(TokenTransferError::InsufficientFunds),
                TransferError::TooOld => Err(TokenTransferError::PermanentError("Transaction timestamp too old".to_string())),
                TransferError::CreatedInFuture { ledger_time } => Err(TokenTransferError::RetryableError(format!(
                    "Transaction timestamp in future. Current ledger time: {:?}",
                    ledger_time
                ))),
                TransferError::Duplicate { duplicate_of } => Err(TokenTransferError::PermanentError(format!(
                    "Duplicate transfer. Original: {:?}",
                    duplicate_of
                ))),
                // This error is explicitly categorized as retryable to enable
                // automatic recovery through the transaction recovery system
                TransferError::TemporarilyUnavailable => {
                    Err(TokenTransferError::RetryableError("Ledger temporarily unavailable".to_string()))
                }
                TransferError::GenericError { error_code, message } => Err(TokenTransferError::LedgerRejection(format!(
                    "Ledger error {}: {}",
                    error_code, message
                ))),
            }
        }
        Err((code, message)) => {
            // Categorize call errors as retryable or permanent
            // RejectionCode::SysFatal is 5, RejectionCode::SysTransient is 4
            // Use debug format since RejectionCode doesn't implement Display
            if matches!(
                code,
                ic_cdk::api::call::RejectionCode::SysTransient | ic_cdk::api::call::RejectionCode::SysFatal
            ) {
                Err(TokenTransferError::RetryableError(format!(
                    "Temporary transfer failure (code: {:?}): {}",
                    code, message
                )))
            } else {
                Err(TokenTransferError::CallError(format!(
                    "Transfer call failed (code: {:?}): {}",
                    code, message
                )))
            }
        }
    }
}

/// Handles platform fee transfers based on token type
///
/// This function processes platform fees collected from market operations.
/// The behavior differs by token type:
/// - For KONG tokens: Burns the tokens (removing them from circulation)
/// - For other tokens: Transfers fees to the designated fee collection account
///
/// # Parameters
/// * `fee_amount` - Amount of tokens to process as fees
/// * `token_id` - Identifier of the token type
///
/// # Returns
/// * `Result<Option<candid::Nat>, TokenTransferError>` - On success, returns the optional
///   block index of the transfer/burn operation. For some operations, no block index is returned.
///   On failure, returns a categorized error.
pub async fn handle_fee_transfer(fee_amount: TokenAmount, token_id: &TokenIdentifier) -> Result<Option<candid::Nat>, TokenTransferError> {
    // Check if token is supported
    let token_info =
        get_token_info(token_id).ok_or(TokenTransferError::UnsupportedToken(format!("Token {} is not supported", token_id)))?;

    // For KONG, burn the tokens
    if token_info.is_kong {
        let block_index = burn_tokens(token_id, fee_amount).await?;
        Ok(Some(block_index))
    } else {
        // For other tokens, transfer to the minter account
        let minter_account = get_minter_account_from_storage();
        let block_index = transfer_token_fees_included(minter_account, fee_amount, token_id).await?;
        Ok(Some(block_index))
    }
}

pub fn get_fee_account(is_kong: bool) -> Principal {
    if is_kong {
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
        let burn_address = Principal::from_text(minter_address).unwrap();

        burn_address
    } else {
        get_minter_account_from_storage()
    }
}

pub fn handle_fee_transfer_failure(
    market_id: crate::nat::MarketId,
    fee_amount: TokenAmount,
    token_info: &TokenInfo,
    e: TokenTransferError,
) {
    let error_msg = format!("{:?}", e);
    // Record failed transaction.
    crate::transaction_recovery::record_failed_transaction(
        Some(market_id.clone()),
        get_fee_account(token_info.is_kong),
        fee_amount,
        token_info.id.clone(),
        error_msg.clone(),
    );
}

/// Burns tokens by transferring them to the burn address
///
/// This function is specifically designed for burning KONG tokens as part of
/// the platform's fee management. It removes tokens from circulation by transferring
/// them to a designated burn address (all zeros). Note that this operation is only
/// applicable for KONG tokens - other tokens collect fees to the minter account instead.
///
/// # Parameters
/// * `token_id` - Identifier of the token to burn (should be KONG)
/// * `amount` - Amount of tokens to burn
///
/// # Returns
/// * `Result<candid::Nat, TokenTransferError>` - On success, returns the block index
///   of the burn transaction. On failure, returns a categorized error.
///
/// # Token-Specific Behavior
/// While this function can technically be called with any token, it should only
/// be used with KONG tokens as part of the platform's economic model. Other tokens
/// should use the standard fee collection mechanism.
pub async fn burn_tokens(token_id: &TokenIdentifier, amount: TokenAmount) -> Result<candid::Nat, TokenTransferError> {
    // Check if token is KONG
    let token_info =
        get_token_info(token_id).ok_or(TokenTransferError::UnsupportedToken(format!("Token {} is not supported", token_id)))?;

    if !token_info.is_kong {
        // For non-KONG tokens, transfer to the minter account instead of burning
        let minter_account = get_minter_account_from_storage();

        ic_cdk::println!("Burning tokens by transferring {} to minter", amount.to_u64());
        return transfer_token_fees_included(minter_account, amount, token_id).await;
    }

    let burn_address = get_fee_account(true);

    // Transfer to the burn address (minter) with zero fee
    let zero_fee = TokenAmount::from(0u64);
    let block_index = transfer_token(burn_address, amount, token_id, zero_fee).await?;
    ic_cdk::println!("Burned tokens with transaction ID: {}", block_index);
    Ok(block_index)
}

/// Calculates the net token amount after deducting platform fees
///
/// This helper function determines the actual amount a user will receive after
/// platform fees are deducted. It uses the token's configured fee percentage
/// to calculate the appropriate fee amount based on the transaction size.
///
/// # Parameters
/// * `amount` - Gross amount before fee deduction
/// * `token_id` - Identifier of the token to calculate fees for
///
/// # Returns
/// * `TokenAmount` - Net amount after fee deduction
///
/// # Fee Calculation
/// Fees are calculated based on the token's fee_percentage configuration:
/// - 1% = 100 (fee_percentage value)
/// - 2% = 200
/// - etc.
///
/// # Edge Cases
/// If the token is not found in the registry, the original amount is returned unchanged.
pub fn calculate_amount_after_fee(amount: &TokenAmount, token_id: &TokenIdentifier) -> TokenAmount {
    let token_info = match get_token_info(token_id) {
        Some(info) => info,
        None => return amount.clone(), // If token not found, no fee
    };

    let fee_percentage = token_info.fee_percentage;

    // Use arbitrary precision arithmetic instead of u64 to handle high-precision tokens like ckETH (18 decimals)
    // First multiply by fee_percentage, then divide by 10000
    let multiplied = amount.clone() * TokenAmount::from(fee_percentage);
    let fee_amount = multiplied / 10000u64; // Division by u64 is supported

    amount.clone() - fee_amount
}
