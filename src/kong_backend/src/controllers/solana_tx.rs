use ic_cdk_macros::query;

use crate::stable_memory::{get_solana_transaction as get_tx, get_transaction_count};
use crate::solana::proxy::types::TransactionNotification;
use crate::ic::guards::caller_is_kingkong;

/// Get a Solana transaction by signature
#[query]
pub fn get_solana_transaction(signature: String) -> Option<TransactionNotification> {
    get_tx(signature)
}

/// Get all Solana transactions (admin only)
#[query(guard = "caller_is_kingkong")]
pub fn get_all_solana_transactions() -> Result<String, String> {
    // Note: The new notifications system doesn't expose a get_all method
    // Return transaction count instead for monitoring purposes
    let count = get_transaction_count();
    Ok(format!("Total Solana transactions stored: {}", count))
}