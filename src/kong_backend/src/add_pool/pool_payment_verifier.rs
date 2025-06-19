//! Pool-specific payment verification module
//! Handles verification of incoming payments for pool creation

use anyhow::Result;
use candid::{Nat, Principal};
use num_traits::ToPrimitive;

use crate::stable_token::stable_token::StableToken;
use crate::stable_solana_tx::solana_tx_map;
use crate::stable_transfer::tx_id::TxId;
use crate::swap::verify_canonical_message::verify_canonical_message;
use crate::ic::network::ICNetwork;

use super::message_builder::CanonicalAddPoolMessage;
use super::add_pool_args::AddPoolArgs;

/// Result of pool payment verification
pub enum PoolPaymentVerification {
    /// Solana/SPL payment verified via signature and transaction
    SolanaPayment {
        tx_signature: String,
        from_address: String,
        amount: u64,
    },
}

/// Pool payment verifier that handles cross-chain pool creation payments
pub struct PoolPaymentVerifier {
    _caller: Principal,
}

impl PoolPaymentVerifier {
    /// Create a new PoolPaymentVerifier instance
    pub fn new(caller: Principal) -> Self {
        Self { _caller: caller }
    }

    /// Verify payment for pool creation with signature
    pub async fn verify_pool_payment(
        &self,
        args: &AddPoolArgs,
        token: &StableToken,
        amount: &Nat,
        tx_id: &TxId,
        signature: &str,
    ) -> Result<PoolPaymentVerification, String> {
        // Only Solana tokens are supported for cross-chain pool creation
        match token {
            StableToken::Solana(_) => {
                verify_solana_pool_payment(args, amount, tx_id, signature).await
            }
            StableToken::IC(_) => {
                Err("IC tokens don't require signature verification for pool creation".to_string())
            }
            StableToken::LP(_) => {
                Err("LP tokens cannot be used for pool creation".to_string())
            }
        }
    }
}

/// Verify Solana payment for pool creation
async fn verify_solana_pool_payment(
    args: &AddPoolArgs,
    amount: &Nat,
    tx_id: &TxId,
    signature: &str,
) -> Result<PoolPaymentVerification, String> {
    // Extract transaction signature
    let tx_signature_str = match tx_id {
        TxId::TransactionId(hash) => hash.clone(),
        TxId::BlockIndex(_) => return Err("BlockIndex not supported for Solana transactions".to_string()),
    };

    // Extract sender from the transaction
    let sender_pubkey = extract_sender_from_transaction(&tx_signature_str).await?;
    
    // Create canonical pool message and verify signature
    let canonical_message = CanonicalAddPoolMessage::from_add_pool_args(args);
    let message_to_verify = canonical_message.to_signing_message();
    
    verify_canonical_message(&message_to_verify, &sender_pubkey, signature)
        .map_err(|e| format!("Pool signature verification failed: {}", e))?;
    
    // Check timestamp freshness (5 minutes)
    let current_time_ms = ICNetwork::get_time() / 1_000_000;
    let message_timestamp = args.timestamp.unwrap_or(current_time_ms);
    let age_ms = current_time_ms.saturating_sub(message_timestamp);
    if age_ms > 300_000 {
        return Err(format!("Pool creation signature timestamp too old: {} ms", age_ms));
    }

    // Verify the actual Solana transaction
    let amount_u64 = amount.0.to_u64().ok_or("Amount too large")?;
    verify_solana_transaction(&tx_signature_str, &sender_pubkey, amount_u64).await?;
    
    Ok(PoolPaymentVerification::SolanaPayment {
        tx_signature: tx_signature_str,
        from_address: sender_pubkey,
        amount: amount_u64,
    })
}

/// Extract sender public key from a Solana transaction
async fn extract_sender_from_transaction(tx_signature: &str) -> Result<String, String> {
    let transaction = solana_tx_map::get(tx_signature)
        .ok_or_else(|| format!("Solana transaction {} not found. Make sure kong_rpc has processed this transaction.", tx_signature))?;
    
    // Parse metadata to extract sender
    if let Some(metadata_json) = &transaction.metadata {
        let metadata: serde_json::Value = serde_json::from_str(metadata_json)
            .map_err(|e| format!("Failed to parse transaction metadata: {}", e))?;
        
        // For SOL transfers: "sender"
        // For SPL transfers: "authority" or "sender_wallet"
        let sender = metadata.get("sender")
            .or_else(|| metadata.get("authority"))
            .or_else(|| metadata.get("sender_wallet"))
            .and_then(|v| v.as_str())
            .ok_or("Transaction metadata missing sender information")?;
            
        Ok(sender.to_string())
    } else {
        Err("Transaction metadata is missing".to_string())
    }
}

/// Verify a Solana transaction exists and matches expected parameters
async fn verify_solana_transaction(
    tx_signature: &str,
    expected_sender: &str,
    expected_amount: u64,
) -> Result<(), String> {
    let transaction = solana_tx_map::get(tx_signature)
        .ok_or_else(|| format!("Solana transaction {} not found", tx_signature))?;
    
    // Check transaction status
    match transaction.status.as_str() {
        "confirmed" | "finalized" => {}, // Good statuses
        "failed" => return Err(format!("Solana transaction {} failed", tx_signature)),
        status => return Err(format!("Solana transaction {} has unexpected status: {}", tx_signature, status)),
    }
    
    // Parse metadata to verify transaction details
    if let Some(metadata_json) = &transaction.metadata {
        let metadata: serde_json::Value = serde_json::from_str(metadata_json)
            .map_err(|e| format!("Failed to parse transaction metadata: {}", e))?;
        
        // Check sender matches
        let actual_sender = metadata.get("sender")
            .or_else(|| metadata.get("authority"))
            .or_else(|| metadata.get("sender_wallet"))
            .and_then(|v| v.as_str())
            .ok_or("Transaction metadata missing sender information")?;
            
        if actual_sender != expected_sender {
            return Err(format!(
                "Transaction sender mismatch. Expected: {}, Got: {}",
                expected_sender, actual_sender
            ));
        }
        
        // Check amount matches
        let actual_amount = metadata.get("amount")
            .and_then(|v| v.as_u64())
            .ok_or("Transaction metadata missing amount")?;
            
        if actual_amount != expected_amount {
            return Err(format!(
                "Transaction amount mismatch. Expected: {}, Got: {}",
                expected_amount, actual_amount
            ));
        }
    } else {
        return Err("Transaction metadata is missing".to_string())
    }
    
    Ok(())
}