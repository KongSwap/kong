use anyhow::Result;
use serde::Deserialize;
use std::str;

use super::error::SolanaError;

/// Common transaction info structure that works for both SOL and SPL tokens
#[derive(Deserialize)]
struct TransactionInfo {
    destination: String,
    source: String,
    #[serde(alias = "lamports", alias = "amount")]
    amount: u64,
}

/// Verify transaction details match expected values
fn verify_transaction_details(tx: &TransactionInfo, expected_sender: &str, expected_receiver: &str, expected_amount: u64) -> Result<()> {
    if tx.source != expected_sender {
        return Err(SolanaError::InvalidTransaction("Transaction source does not match sender public key".to_string()).into());
    }

    if tx.destination != expected_receiver {
        return Err(SolanaError::InvalidTransaction("Transaction destination does not match receiver public key".to_string()).into());
    }

    if tx.amount != expected_amount {
        return Err(SolanaError::InvalidTransaction("Transaction amount does not match expected amount".to_string()).into());
    }

    Ok(())
}
