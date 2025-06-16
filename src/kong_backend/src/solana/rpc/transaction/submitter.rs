//! Solana Transaction Submitter
//!
//! This module provides functionality for submitting Solana transactions.

use anyhow::Result;
use bs58;
use candid::Principal;
use serde_json::json;

use crate::solana::error::SolanaError;
use crate::solana::rpc::client::SolanaRpcClient;
use crate::solana::rpc::transaction::signer::SignedTransaction;

use super::builder::TransactionInstructions;

impl SolanaRpcClient {
    /// Submit a signed transaction
    ///
    /// # Arguments
    ///
    /// * `canister` - The signing canister principal ID
    /// * `instructions` - The transaction instructions to sign
    /// * `fee_payer` - The address that will pay the transaction fee
    ///
    /// # Returns
    ///
    /// The transaction tx signature
    pub async fn submit_transaction(&self, canister: &Principal, instructions: TransactionInstructions, fee_payer: &str) -> Result<String> {
        // Sign the transaction
        let signed_transaction = self.sign_transaction(canister, instructions, fee_payer).await?;

        // Encode the transaction for submission
        let encoded_transaction = self.encode_transaction(&signed_transaction)?;

        // Submit the transaction to the network
        self.send_transaction(&encoded_transaction).await
    }

    /// Encode a transaction for submission
    ///
    /// # Arguments
    ///
    /// * `signed_transaction` - The signed transaction to encode
    ///
    /// # Returns
    ///
    /// The base58-encoded transaction
    pub fn encode_transaction(&self, signed_transaction: &SignedTransaction) -> Result<String> {
        // For Solana transaction serialization, we need to follow the correct format for a legacy transaction
        // (not a versioned transaction)

        // Create a buffer for the serialized transaction
        let mut transaction_bytes = Vec::new();

        // 1. Add signature count as a single byte (we only have one signature)
        transaction_bytes.push(1);

        // 2. Add the signature (64 bytes for Ed25519)
        // If the signature is not 64 bytes, we'll pad or truncate it
        let signature = match signed_transaction.signature.len().cmp(&64) {
            std::cmp::Ordering::Less => {
                // Pad with zeros if too short
                let mut padded = signed_transaction.signature.clone();
                padded.resize(64, 0);
                padded
            }
            std::cmp::Ordering::Greater => {
                // Truncate if too long
                signed_transaction.signature[0..64].to_vec()
            }
            std::cmp::Ordering::Equal => {
                // Use as is if exactly 64 bytes
                signed_transaction.signature.clone()
            }
        };
        transaction_bytes.extend_from_slice(&signature);

        // 3. Add the message data
        transaction_bytes.extend_from_slice(&signed_transaction.transaction_data);

        // Base58 encode the transaction
        let encoded = bs58::encode(transaction_bytes).into_string();

        Ok(encoded)
    }

    /// Send a transaction to the Solana network
    ///
    /// # Arguments
    ///
    /// * `encoded_transaction` - The base58-encoded transaction
    ///
    /// # Returns
    ///
    /// The transaction signature
    async fn send_transaction(&self, encoded_transaction: &str) -> Result<String> {
        // Create the RPC request
        let method = "sendTransaction";
        let params = json!([
            encoded_transaction,
            {
                "skipPreflight": false,
                "preflightCommitment": "confirmed",
                "encoding": "base58"
            }
        ]);
        let response = self.make_rpc_call(method, params).await?;
        if let Some(result) = response.get("result") {
            if let Some(signature) = result.as_str() {
                return Ok(signature.to_string());
            }
        }
        // Handle error
        if let Some(error) = response.get("error") {
            if let Some(message) = error.get("message") {
                if let Some(msg_str) = message.as_str() {
                    return Err(SolanaError::TransactionError(format!("Transaction submission failed: {}", msg_str)).into());
                }
            }
        }

        Err(SolanaError::TransactionError(
            "Failed to parse transaction submission response".to_string(),
        ))?
    }
}
