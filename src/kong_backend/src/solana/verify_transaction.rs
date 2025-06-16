use anyhow::Result;
use serde::Deserialize;
use std::str;

use super::error::SolanaError;
use super::network::SolanaNetwork;
use super::rpc::client::SolanaRpcClient;

/// Common transaction info structure that works for both SOL and SPL tokens
#[derive(Deserialize)]
struct TransactionInfo {
    destination: String,
    source: String,
    #[serde(alias = "lamports", alias = "amount")]
    amount: u64,
}

impl SolanaNetwork {
    pub async fn verify_transaction(
        rpc_client: &SolanaRpcClient,
        token_id: u32,
        tx_signature: &str,
        sender_pubkey: &str,
        receiver_pubkey: &str,
        amount: u64,
        _timestamp: u64,
    ) -> Result<bool> {
        // Get transaction based on token type
        let tx_json = match token_id {
            1 => {
                // SOL transaction
                rpc_client.get_sol_transaction(tx_signature).await
            }
            _ => {
                // SPL token transaction
                rpc_client.get_spl_transaction(tx_signature).await
            }
        }?;

        // Parse transaction info
        let tx = serde_json::from_str::<TransactionInfo>(&tx_json).map_err(|e| {
            SolanaError::EncodingError(format!("Failed to parse transaction: {}", e))
        })?;

        // Verify transaction details
        verify_transaction_details(&tx, sender_pubkey, receiver_pubkey, amount)?;

        Ok(true)
    }
}

/// Verify transaction details match expected values
fn verify_transaction_details(
    tx: &TransactionInfo,
    expected_sender: &str,
    expected_receiver: &str,
    expected_amount: u64,
) -> Result<()> {
    if tx.source != expected_sender {
        return Err(SolanaError::InvalidTransaction(
            "Transaction source does not match sender public key".to_string(),
        )
        .into());
    }

    if tx.destination != expected_receiver {
        return Err(SolanaError::InvalidTransaction(
            "Transaction destination does not match receiver public key".to_string(),
        )
        .into());
    }

    if tx.amount != expected_amount {
        return Err(SolanaError::InvalidTransaction(
            "Transaction amount does not match expected amount".to_string(),
        )
        .into());
    }

    Ok(())
}
