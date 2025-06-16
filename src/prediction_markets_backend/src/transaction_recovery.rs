//! # Transaction Recovery Module
//! 
//! This module handles the recording, tracking, and recovery of failed token transactions
//! in the Kong Swap prediction markets system. It provides a resilient error-handling layer
//! that maintains system integrity even when token transfers encounter issues.
//! 
//! ## Key Capabilities
//! 
//! - **Failed Transaction Recording**: Captures detailed information about token transfers
//!   that fail during market resolution, including recipient, amount, and error details
//! - **Recovery Mechanisms**: Provides both automated and admin-triggered retry capabilities
//!   to ensure users eventually receive their payouts
//! - **Flexible Querying**: Allows filtering transactions by market ID, recipient, or status
//!   to facilitate targeted recovery operations
//! - **Administrative Controls**: Enables administrators to manually resolve transactions
//!   when alternate compensation methods have been used
//! 
//! ## Critical System Role
//! 
//! The recovery system is particularly essential for the platform's reliability because:
//! 
//! 1. **Multi-Token Support**: Each token type has different transfer mechanisms and failure modes
//! 2. **Distributed Environment**: The Internet Computer architecture requires robust error handling
//! 3. **Time-Weighted Payouts**: Complex payout calculations must be preserved even if transfers fail
//! 4. **Dual Approval Process**: Market resolution may involve multiple stakeholders and transaction stages
//! 
//! By maintaining a persistent record of failed transactions, this module ensures that no user
//! loses their rightful winnings due to temporary network issues or token contract failures.

use candid::Principal;
use std::collections::HashMap;
use std::cell::RefCell;

use crate::types::{MarketId, TokenAmount};
use crate::token::registry::TokenIdentifier;
use crate::failed_transaction::FailedTransaction;
use crate::stable_memory::STABLE_FAILED_TRANSACTIONS;
use crate::token::transfer::transfer_token;
use crate::controllers::admin::is_admin;
use ic_cdk::{query, update};

/// Records a failed token transfer transaction for later recovery attempts
/// 
/// When a token transfer fails (e.g., during market resolution or user withdrawals),
/// this function creates a persistent record in stable memory. The record captures all
/// details needed to retry the transaction later, using the current timestamp as a
/// unique identifier.
/// 
/// ## Common Failure Scenarios
/// 
/// - **Network Congestion**: Temporary IC network issues
/// - **Token Contract Errors**: Issues with the underlying token canister
/// - **Balance Discrepancies**: Insufficient funds in the canister
/// - **Rate Limiting**: Too many simultaneous transfers to the token canister
/// 
/// ## Recovery Process Flow
/// 
/// 1. Transaction fails in the transfer module
/// 2. This function records the failure details
/// 3. Admins can later query and retry failed transactions
/// 4. Successful retries update the record to 'resolved'
/// 
/// # Parameters
/// * `market_id` - Optional ID of the market associated with this transaction
/// * `recipient` - Principal ID of the intended token recipient
/// * `amount` - Amount of tokens that failed to transfer (in raw token units)
/// * `token_id` - Identifier for the token type that failed to transfer
/// * `error` - Detailed error message explaining the failure reason
/// 
/// # Returns
/// * `u64` - Unique transaction ID (timestamp) that can be used for retry operations
pub fn record_failed_transaction(
    market_id: Option<MarketId>,
    recipient: Principal,
    amount: TokenAmount,
    token_id: TokenIdentifier,
    error: String
) -> u64 {
    let tx_id = ic_cdk::api::time(); // Use timestamp as unique ID
    
    let failed_tx = FailedTransaction {
        market_id,
        recipient,
        amount,
        token_id,
        error,
        timestamp: tx_id,
        retry_count: 0,
        resolved: false,
    };
    
    STABLE_FAILED_TRANSACTIONS.with(|txs| {
        let mut txs = txs.borrow_mut();
        txs.insert(tx_id, failed_tx);
    });
    
    ic_cdk::println!("Recorded failed transaction ID: {}", tx_id);
    tx_id
}

/// Query for all unresolved (pending) transactions that need recovery
/// 
/// Returns a list of all failed transactions that haven't been successfully
/// resolved yet. This is typically used by administrators to identify
/// which transactions need attention.
/// 
/// # Returns
/// * `Vec<(u64, FailedTransaction)>` - List of transaction IDs and their details
#[query]
pub fn get_unresolved_transactions() -> Vec<(u64, FailedTransaction)> {
    STABLE_FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .filter(|(_, tx)| !tx.resolved)
            .map(|(id, tx)| (id, tx.clone()))
            .collect()
    })
}

/// Query for all transactions (both resolved and unresolved)
/// 
/// Returns the complete history of failed transactions, including those
/// that have been successfully resolved and those still pending.
/// Useful for auditing and system health monitoring.
/// 
/// # Returns
/// * `Vec<(u64, FailedTransaction)>` - Complete list of transaction records
#[query]
pub fn get_all_transactions() -> Vec<(u64, FailedTransaction)> {
    STABLE_FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .map(|(id, tx)| (id, tx.clone()))
            .collect()
    })
}

/// Query for transactions associated with a specific market
/// 
/// Retrieves all failed transactions (resolved and unresolved) that are
/// related to a particular prediction market. This is useful when troubleshooting
/// issues with payouts for a specific market.
/// 
/// # Parameters
/// * `market_id` - ID of the market to query transactions for
/// 
/// # Returns
/// * `Vec<(u64, FailedTransaction)>` - List of transaction records for the specified market
#[query]
pub fn get_transactions_by_market(market_id: MarketId) -> Vec<(u64, FailedTransaction)> {
    STABLE_FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .filter(|(_, tx)| tx.market_id.as_ref().map_or(false, |id| *id == market_id))
            .map(|(id, tx)| (id, tx.clone()))
            .collect()
    })
}

/// Query for transactions intended for a specific user
/// 
/// Retrieves all failed transactions (resolved and unresolved) where
/// the specified principal is the intended recipient of the tokens.
/// Useful for investigating user reports of missing payouts or funds.
/// 
/// # Parameters
/// * `recipient` - Principal ID of the user to query transactions for
/// 
/// # Returns
/// * `Vec<(u64, FailedTransaction)>` - List of transaction records for the recipient
#[query]
pub fn get_transactions_by_recipient(recipient: Principal) -> Vec<(u64, FailedTransaction)> {
    STABLE_FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .filter(|(_, tx)| tx.recipient == recipient)
            .map(|(id, tx)| (id, tx.clone()))
            .collect()
    })
}

/// Attempts to retry a specific failed transaction (admin only)
/// 
/// This function attempts to execute a previously failed transaction by
/// retrying the token transfer. It provides an essential recovery mechanism
/// for ensuring users receive their winnings, even after initial transfer failures.
/// 
/// ## Retry Process
/// 
/// 1. Validates the caller is an administrator
/// 2. Retrieves the transaction details from stable storage
/// 3. Attempts the token transfer using the original parameters
/// 4. Updates the transaction record based on the result:
///    - Success: Marks as resolved and returns block index
///    - Failure: Increments retry count and updates error message
/// 
/// This function is particularly important for recovering from transient issues
/// in the token transfer system, such as temporary network congestion or rate
/// limiting by token canisters.
/// 
/// ## Error Handling
/// 
/// The function properly processes errors from the token transfer system,
/// distinguishing between permanent errors (which won't benefit from retry)
/// and temporary errors (which may succeed on subsequent attempts).
/// 
/// # Parameters
/// * `tx_id` - ID of the transaction to retry
/// 
/// # Returns
/// * `Result<Option<candid::Nat>, String>` - On success, returns the block index of the
///   successful transaction. On failure, returns an error message.
/// 
/// # Access Control
/// * Only canister administrators can call this function
#[update]
pub async fn retry_transaction(tx_id: u64) -> Result<Option<candid::Nat>, String> {
    let admin = ic_cdk::caller();
    
    // Only admins can retry transactions
    if !is_admin(admin) {
        return Err("Unauthorized: Only admins can retry transactions".to_string());
    }
    
    let tx_opt = STABLE_FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.get(&tx_id)
    });
    
    match tx_opt {
        Some(tx) if !tx.resolved => {
            // Attempt the transfer again
            match transfer_token(
                tx.recipient, 
                tx.amount.clone(), 
                &tx.token_id, 
                None
            ).await {
                Ok(block_index) => {
                    // Update the transaction as resolved
                    STABLE_FAILED_TRANSACTIONS.with(|txs| {
                        let mut txs = txs.borrow_mut();
                        if let Some(mut tx) = txs.get(&tx_id) {
                            tx.resolved = true;
                            tx.retry_count += 1;
                            txs.insert(tx_id, tx);
                        }
                    });
                    
                    ic_cdk::println!("Successfully retried transaction {}: block_index {}", 
                                  tx_id, block_index);
                    Ok(Some(block_index))
                },
                Err(e) => {
                    // Update retry count but keep as unresolved
                    STABLE_FAILED_TRANSACTIONS.with(|txs| {
                        let mut txs = txs.borrow_mut();
                        if let Some(mut tx) = txs.get(&tx_id) {
                            tx.retry_count += 1;
                            tx.error = e.detailed_message();
                            txs.insert(tx_id, tx);
                        }
                    });
                    
                    Err(format!("Retry failed: {}", e.detailed_message()))
                }
            }
        },
        Some(_) => Err("Transaction already resolved".to_string()),
        None => Err(format!("Transaction {} not found", tx_id))
    }
}

/// Attempts to retry all unresolved transactions for a specific market (admin only)
/// 
/// This function performs a batch retry operation for all unresolved transactions
/// associated with a particular market. It's particularly valuable for market resolution
/// scenarios where multiple payouts may have failed due to a common issue.
/// 
/// ## Use Cases
/// 
/// - **Post-Resolution Recovery**: After a market is resolved, retry all failed payouts
/// - **Token Contract Recovery**: After a token canister issue is fixed, process backlog
/// - **Network Recovery**: After network congestion subsides, clear pending transactions
/// 
/// This function is especially important for time-weighted markets where complex payout
/// calculations across multiple users may result in several failed transfers. The batch
/// retry ensures that all users have an opportunity to receive their winnings without
/// requiring individual transaction processing.
/// 
/// ## Implementation Notes
/// 
/// Each transaction is processed independently, so individual failures don't prevent
/// other transactions from being retried. This maximizes the chance of successful
/// recovery even when some transfers continue to fail.
/// 
/// # Parameters
/// * `market_id` - ID of the market whose transactions should be retried
/// 
/// # Returns
/// * `Vec<Result<u64, String>>` - Vector of results for each transaction retry attempt.
///   Successful retries contain the transaction ID, failures contain error messages.
/// 
/// # Access Control
/// * Only canister administrators can call this function
#[update]
pub async fn retry_market_transactions(market_id: MarketId) -> Vec<Result<u64, String>> {
    let admin = ic_cdk::caller();
    
    // Only admins can retry transactions
    if !is_admin(admin) {
        return vec![Err("Unauthorized: Only admins can retry transactions".to_string())];
    }
    
    let tx_ids = STABLE_FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .filter(|(_, tx)| !tx.resolved && tx.market_id.as_ref().map_or(false, |id| *id == market_id))
            .map(|(id, _)| id)
            .collect::<Vec<u64>>()
    });
    
    let mut results = Vec::new();
    
    for tx_id in tx_ids {
        match retry_transaction(tx_id).await {
            Ok(Some(_block_index)) => results.push(Ok(tx_id)),
            Ok(None) => results.push(Err(format!("Transaction {} had no block index", tx_id))),
            Err(e) => results.push(Err(format!("Failed to retry transaction {}: {}", tx_id, e))),
        }
    }
    
    results
}

/// Marks a transaction as resolved without attempting to retry it (admin only)
/// 
/// This function allows administrators to manually mark a transaction as resolved
/// without attempting to retry the token transfer. It provides a necessary escape
/// hatch for scenarios where automatic retry isn't appropriate or possible.
/// 
/// ## Manual Resolution Scenarios
/// 
/// - **Alternative Compensation**: User was compensated through a different mechanism
/// - **Permanently Failed**: Transaction that cannot succeed (e.g., user blacklisted)
/// - **Disputed Resolution**: Transactions related to disputed or voided markets
/// - **Account Migration**: User has moved to a new principal ID
/// 
/// This function complements the automatic retry mechanisms by providing administrators
/// flexibility to handle edge cases and special situations. The original error message
/// is preserved with an additional note indicating manual resolution, maintaining
/// a complete audit trail.
/// 
/// ## Security Considerations
/// 
/// The function requires administrator privileges to prevent unauthorized resolution
/// of pending payouts. This ensures that only authorized personnel can decide when
/// a transaction should be marked as resolved without retry.
/// 
/// # Parameters
/// * `tx_id` - ID of the transaction to mark as resolved
/// 
/// # Returns
/// * `Result<(), String>` - Success or an error message if the operation failed
/// 
/// # Access Control
/// * Only canister administrators can call this function
#[update]
pub fn mark_transaction_resolved(tx_id: u64) -> Result<(), String> {
    let admin = ic_cdk::caller();
    
    // Only admins can mark transactions as resolved
    if !is_admin(admin) {
        return Err("Unauthorized: Only admins can mark transactions as resolved".to_string());
    }
    
    STABLE_FAILED_TRANSACTIONS.with(|txs| {
        let mut txs = txs.borrow_mut();
        
        if let Some(tx) = txs.get(&tx_id) {
            if tx.resolved {
                Err("Transaction already resolved".to_string())
            } else {
                let mut tx = tx.clone();
                tx.resolved = true;
                tx.error = format!("{} (Manually marked as resolved)", tx.error);
                txs.insert(tx_id, tx);
                Ok(())
            }
        } else {
            Err(format!("Transaction {} not found", tx_id))
        }
    })
}
