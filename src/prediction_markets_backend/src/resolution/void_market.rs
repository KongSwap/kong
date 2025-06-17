//! # Market Voiding Module
//! 
//! This module implements the logic for voiding prediction markets and refunding all bets to users.
//! Voiding is used in several scenarios:
//! 
//! 1. When a market is determined to be invalid or impossible to resolve
//! 2. When there's disagreement between a creator and admin about the resolution 
//! 3. When admins need to cancel a market for policy or technical reasons
//! 
//! The voiding process ensures all users receive refunds of their original bets, with robust
//! error handling and retry mechanisms to handle transient failures in the distributed system.

use super::resolution::*;

use crate::market::market::*;
use crate::controllers::admin::*;
use crate::types::MarketId;
use crate::token::registry::{get_token_info, TokenIdentifier};
use crate::token::transfer::{transfer_token_fees_included, TokenTransferError};
use crate::transaction_recovery::record_failed_transaction;
use crate::storage::MARKETS;

/// Helper function with retry logic specifically for void market refunds
/// 
/// This function attempts to refund tokens to users with a configurable retry mechanism
/// for handling transient errors. When all retries are exhausted, it records the failed
/// transaction for later recovery through the transaction recovery system.
/// 
/// # Parameters
/// * `user` - Principal ID of the refund recipient
/// * `amount` - Amount of tokens to refund
/// * `token_id` - Identifier for the token type to refund
/// * `retry_count` - Maximum number of retry attempts
/// * `market_id` - ID of the market being voided (for transaction recovery tracking)
/// 
/// # Returns
/// * `Result<Option<candid::Nat>, TokenTransferError>` - On success, returns the optional
///   transaction ID. On failure, returns a token transfer error after recording the
///   failed transaction for later recovery.
async fn refund_with_retry(
    user: candid::Principal, 
    amount: crate::types::TokenAmount,
    token_id: &TokenIdentifier,
    retry_count: u8,
    market_id: &MarketId
) -> Result<Option<candid::Nat>, TokenTransferError> {
    let mut attempts = 0;
    let max_attempts = retry_count + 1; // Initial attempt + retries
    
    loop {
        attempts += 1;
        match transfer_token_fees_included(user, amount.clone(), token_id).await {
            Ok(tx_id) => return Ok(Some(tx_id)),
            Err(e) if e.is_retryable() && attempts < max_attempts => {
                ic_cdk::println!("Refund attempt {} failed with retryable error: {}. Retrying...", 
                               attempts, e.detailed_message());
                // In a real implementation, you'd use a timer, but for simplicity we retry immediately
            },
            Err(e) => {
                ic_cdk::println!("Refund failed after {} attempts: {}",
                               attempts, e.detailed_message());
                
                // Record the failed transaction for potential recovery later
                let tx_id = record_failed_transaction(
                    Some(market_id.clone()),
                    user,
                    amount,
                    token_id.clone(),
                    e.detailed_message()
                );
                
                ic_cdk::println!("Recorded failed refund as transaction {}", tx_id);
                return Err(e);
            }
        }
    }
}

/// Voids a market and returns all bets to the users
/// 
/// This function handles the complete market voiding process, including:
/// 1. Validation of the caller's permissions and market state
/// 2. Retrieval of all bets associated with the market
/// 3. Refunding tokens to all bettors using the original token types
/// 4. Handling failed refunds with retry logic and transaction recovery
/// 5. Updating the market status to Voided
/// 
/// The function is designed to be resilient against individual refund failures.
/// Even if some refunds fail, the process continues to ensure that as many users
/// as possible receive their refunds, with failed cases recorded for later recovery.
/// 
/// Note: The actual #[update] function is defined in dual_approval.rs. This function
/// contains the core implementation called from there.
/// 
/// # Parameters
/// * `market_id` - ID of the market to void
/// 
/// # Returns
/// * `Result<(), ResolutionError>` - Success or an error reason if the process fails
/// 
/// # Security
/// Only admins can call this function directly. Market creators can trigger
/// the voiding process indirectly through resolution disagreements.
pub async fn void_market(market_id: MarketId) -> Result<(), ResolutionError> {
    let admin = ic_cdk::caller();

    // Verify the caller is an admin
    if !is_admin(admin) {
        return Err(ResolutionError::Unauthorized);
    }

    // Get market and validate state
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound)
    })?;

    // Verify market is not already resolved
    if !matches!(market.status, MarketStatus::Active | MarketStatus::Disputed) {
        return Err(ResolutionError::AlreadyResolved);
    }

    ic_cdk::println!("Voiding market {}", market_id.to_u64());

    // Get all bets for this market using our helper function
    let bets = crate::storage::get_bets_for_market(&market_id);

    ic_cdk::println!("Found {} bets to refund", bets.len());

    // Return all bets to users using the appropriate token for each bet
    // Process each bet independently to ensure that failures in one refund
    // don't prevent other users from receiving their refunds
    for bet in bets {
        // Get token info for the bet's token
        let token_id = &bet.token_id;
        let token_info = match get_token_info(token_id) {
            Some(info) => info,
            None => {
                ic_cdk::println!("Unsupported token: {}, skipping refund", token_id);
                continue;
            }
        };
        
        // Check if bet amount exceeds transfer fee for this token
        // Users only receive their bet minus the transfer fee, ensuring
        // the transfer operation has enough funds to cover its costs
        if bet.amount <= token_info.transfer_fee {
            ic_cdk::println!(
                "Skipping transfer - bet amount {} less than fee {}",
                bet.amount.to_u64(),
                token_info.transfer_fee.to_u64()
            );
            continue; // Skip if bet amount is less than transfer fee
        }

        ic_cdk::println!("Returning {} {} tokens to {}", 
                        bet.amount.to_u64() / 10u64.pow(token_info.decimals as u32),
                        token_info.symbol,
                        bet.user.to_string());

        // Transfer tokens back to the bettor using our retry helper
        // Using 2 retries for recoverable errors to improve reliability while
        // preventing excessive resource consumption on non-recoverable errors
        match refund_with_retry(bet.user, bet.amount, token_id, 2, &market_id).await {
            Ok(Some(tx_id)) => {
                ic_cdk::println!("Refund successful (Transaction ID: {})", tx_id);
            },
            Ok(None) => {
                ic_cdk::println!("Refund completed but no transaction ID returned");
            },
            Err(e) => {
                // Instead of failing the entire market voiding, log the error and continue with other refunds
                ic_cdk::println!("Refund failed: {}. Continuing with other refunds.", e.detailed_message());
                // Record the failure in the log but don't abort the market voiding process
            }
        }
    }

    // Update market status to Voided - this happens even if some refunds failed
    // to prevent future resolution attempts on this market
    market.status = MarketStatus::Voided;
    
    // Update market in storage with the new voided status
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });
    
    // Return success, even if some individual refunds failed
    // The transaction recovery system will handle any failed refunds

    Ok(())
}
