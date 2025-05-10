use anyhow::Result;
use serde::Deserialize;
use std::str;
use std::str::FromStr;

use super::error::SolanaError;
use super::network::SolanaNetwork;
use super::rpc::client::SolanaRpcClient;
use super::sdk::offchain_message::OffchainMessage;
use super::sdk::pubkey::SolanaPubkey as Pubkey;
use super::sdk::signature::SolanaSignature as Signature;

impl SolanaNetwork {
    /// Verify a transaction signature
    /// Used to verify that the message is signed by the sender and the pubkey is of the sender
    /// Message format:
    ///    pay_tx_signature:timestamp
    pub fn verify_transaction_signature(
        message: &str,
        public_key: &str,
        signature: &str,
    ) -> Result<(String, String, u64)> {
        let parts = message.splitn(2, ':').collect::<Vec<&str>>();
        if parts.len() != 2 {
            Err(SolanaError::InvalidMessageSigning(
                "Invalid message format pubkey:tx_hash:timestamp".to_string(),
            ))?;
        }
        let tx_signature = str::from_utf8(parts[0].as_bytes()).map_err(|_| {
            SolanaError::InvalidMessageSigning("Invalid transaction signature".to_string())
        })?;
        let timestamp = parts[1]
            .parse::<u64>()
            .map_err(|_| SolanaError::InvalidMessageSigning("Invalid timestamp".to_string()))?;

        let offchain_message = OffchainMessage::new(0, message.as_bytes()).map_err(|e| {
            SolanaError::InvalidMessageSigning(format!("Failed to create offchain message: {}", e))
        })?;
        let pubkey = Pubkey::from_str(public_key).map_err(|e| {
            SolanaError::InvalidMessageSigning(format!("Invalid public key format: {}", e))
        })?;
        let sig = Signature::from_str(signature).map_err(|e| {
            SolanaError::InvalidMessageSigning(format!("Invalid signature format: {}", e))
        })?;

        offchain_message.verify(&pubkey, &sig).map_err(|e| {
            SolanaError::InvalidSignature(format!("Signature verification failed: {}", e))
        })?;

        Ok((pubkey.to_string(), tx_signature.to_string(), timestamp))
    }

    pub async fn verify_transaction(
        rpc_client: &SolanaRpcClient,
        token_id: u32,
        tx_signature: &str,
        sender_pubkey: &str,
        receiver_pubkey: &str,
        amount: u64,
        _timestamp: u64,
    ) -> Result<bool> {
        if token_id == 1 {
            // SOL
            #[derive(Deserialize)]
            struct Info {
                destination: String,
                lamports: u64,
                source: String,
            }

            let tx_json = rpc_client.get_sol_transaction(tx_signature).await?;
            let tx = serde_json::from_str::<Info>(&tx_json).map_err(|e| {
                SolanaError::EncodingError(format!("Failed to parse transaction: {}", e))
            })?;
            if tx.destination != receiver_pubkey {
                Err(SolanaError::InvalidTransaction(
                    "Transaction destination does not match receiver public key".to_string(),
                ))?;
            }
            if tx.source != sender_pubkey {
                Err(SolanaError::InvalidTransaction(
                    "Transaction source does not match sender public key".to_string(),
                ))?;
            }
            if tx.lamports != amount {
                Err(SolanaError::InvalidTransaction(
                    "Transaction amount does not match expected amount".to_string(),
                ))?;
            }
        } else {
            // SPL token
            #[derive(Deserialize)]
            struct Info {
                destination: String,
                #[allow(dead_code)]
                authority: String,
                amount: u64,
                source: String,
            }

            let tx_json = rpc_client.get_sol_transaction(tx_signature).await?;
            let tx = serde_json::from_str::<Info>(&tx_json).map_err(|e| {
                SolanaError::EncodingError(format!("Failed to parse transaction: {}", e))
            })?;
            if tx.destination != receiver_pubkey {
                Err(SolanaError::InvalidTransaction(
                    "Transaction destination does not match receiver public key".to_string(),
                ))?;
            }
            if tx.source != sender_pubkey {
                Err(SolanaError::InvalidTransaction(
                    "Transaction source does not match sender public key".to_string(),
                ))?;
            }
            if tx.amount != amount {
                Err(SolanaError::InvalidTransaction(
                    "Transaction amount does not match expected amount".to_string(),
                ))?;
            }
        }

        Ok(true)
    }
}