use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;
use std::collections::HashMap;
use std::cell::RefCell;

use crate::types::{MarketId, TokenAmount};
use crate::token::registry::TokenIdentifier;
use crate::token::transfer::transfer_token;
use crate::controllers::admin::is_admin;
use ic_cdk::{query, update};

/// Record of a failed transaction for potential recovery
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedTransaction {
    pub market_id: Option<MarketId>,
    pub recipient: Principal,
    pub amount: TokenAmount,
    pub token_id: TokenIdentifier,
    pub error: String,
    pub timestamp: u64,
    pub retry_count: u8,
    pub resolved: bool,
}

// Stable storage for failed transactions
thread_local! {
    static FAILED_TRANSACTIONS: RefCell<HashMap<u64, FailedTransaction>> = 
        RefCell::new(HashMap::new());
}

/// Record a failed transaction for later recovery
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
    
    FAILED_TRANSACTIONS.with(|txs| {
        let mut txs = txs.borrow_mut();
        txs.insert(tx_id, failed_tx);
    });
    
    ic_cdk::println!("Recorded failed transaction ID: {}", tx_id);
    tx_id
}

/// Query for all unresolved transactions
#[query]
pub fn get_unresolved_transactions() -> Vec<(u64, FailedTransaction)> {
    FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .filter(|(_, tx)| !tx.resolved)
            .map(|(id, tx)| (*id, tx.clone()))
            .collect()
    })
}

/// Query for all transactions (resolved and unresolved)
#[query]
pub fn get_all_transactions() -> Vec<(u64, FailedTransaction)> {
    FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .map(|(id, tx)| (*id, tx.clone()))
            .collect()
    })
}

/// Query for transactions by market ID
#[query]
pub fn get_transactions_by_market(market_id: MarketId) -> Vec<(u64, FailedTransaction)> {
    FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .filter(|(_, tx)| tx.market_id.as_ref().map_or(false, |id| *id == market_id))
            .map(|(id, tx)| (*id, tx.clone()))
            .collect()
    })
}

/// Query for transactions by recipient
#[query]
pub fn get_transactions_by_recipient(recipient: Principal) -> Vec<(u64, FailedTransaction)> {
    FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .filter(|(_, tx)| tx.recipient == recipient)
            .map(|(id, tx)| (*id, tx.clone()))
            .collect()
    })
}

/// Retry a specific transaction - admin only
#[update]
pub async fn retry_transaction(tx_id: u64) -> Result<Option<candid::Nat>, String> {
    let admin = ic_cdk::caller();
    
    // Only admins can retry transactions
    if !is_admin(admin) {
        return Err("Unauthorized: Only admins can retry transactions".to_string());
    }
    
    let tx_opt = FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.get(&tx_id).cloned()
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
                    FAILED_TRANSACTIONS.with(|txs| {
                        let mut txs = txs.borrow_mut();
                        if let Some(tx) = txs.get_mut(&tx_id) {
                            tx.resolved = true;
                            tx.retry_count += 1;
                        }
                    });
                    
                    ic_cdk::println!("Successfully retried transaction {}: block_index {}", 
                                  tx_id, block_index);
                    Ok(Some(block_index))
                },
                Err(e) => {
                    // Update retry count but keep as unresolved
                    FAILED_TRANSACTIONS.with(|txs| {
                        let mut txs = txs.borrow_mut();
                        if let Some(tx) = txs.get_mut(&tx_id) {
                            tx.retry_count += 1;
                            tx.error = e.detailed_message();
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

/// Retry all unresolved transactions for a market - admin only
#[update]
pub async fn retry_market_transactions(market_id: MarketId) -> Vec<Result<u64, String>> {
    let admin = ic_cdk::caller();
    
    // Only admins can retry transactions
    if !is_admin(admin) {
        return vec![Err("Unauthorized: Only admins can retry transactions".to_string())];
    }
    
    let tx_ids = FAILED_TRANSACTIONS.with(|txs| {
        let txs = txs.borrow();
        txs.iter()
            .filter(|(_, tx)| !tx.resolved && tx.market_id.as_ref().map_or(false, |id| *id == market_id))
            .map(|(id, _)| *id)
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

/// Mark a transaction as resolved without retrying - admin only
#[update]
pub fn mark_transaction_resolved(tx_id: u64) -> Result<(), String> {
    let admin = ic_cdk::caller();
    
    // Only admins can mark transactions as resolved
    if !is_admin(admin) {
        return Err("Unauthorized: Only admins can mark transactions as resolved".to_string());
    }
    
    FAILED_TRANSACTIONS.with(|txs| {
        let mut txs = txs.borrow_mut();
        if let Some(tx) = txs.get_mut(&tx_id) {
            if tx.resolved {
                Err("Transaction already resolved".to_string())
            } else {
                tx.resolved = true;
                tx.error = format!("{} (Manually marked as resolved)", tx.error);
                Ok(())
            }
        } else {
            Err(format!("Transaction {} not found", tx_id))
        }
    })
}
