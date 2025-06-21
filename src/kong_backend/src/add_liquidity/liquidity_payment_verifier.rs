//! Liquidity-specific payment verification module
//! Handles verification of incoming payments for liquidity provision

use anyhow::Result;
use candid::{Nat, Principal};
use num_traits::ToPrimitive;

use crate::stable_token::stable_token::StableToken;
use crate::stable_transfer::tx_id::TxId;
use crate::swap::verify_canonical_message::verify_canonical_message;
use crate::ic::network::ICNetwork;
use crate::stable_memory::get_solana_transaction;

use super::message_builder::CanonicalAddLiquidityMessage;
use super::add_liquidity_args::AddLiquidityArgs;

/// Result of liquidity payment verification
pub enum LiquidityPaymentVerification {
    /// Solana/SPL payment verified via signature and transaction
    SolanaPayment {
        tx_signature: String,
        from_address: String,
        amount: u64,
    },
}

/// Liquidity payment verifier that handles cross-chain liquidity provision payments
pub struct LiquidityPaymentVerifier {
    _caller: Principal,
}

impl LiquidityPaymentVerifier {
    /// Create a new LiquidityPaymentVerifier instance
    pub fn new(caller: Principal) -> Self {
        Self { _caller: caller }
    }

    /// Verify payment for liquidity provision with signature
    pub async fn verify_liquidity_payment(
        &self,
        args: &AddLiquidityArgs,
        token: &StableToken,
        amount: &Nat,
        tx_id: &TxId,
        signature: &str,
    ) -> Result<LiquidityPaymentVerification, String> {
        // Only Solana tokens are supported for cross-chain liquidity provision
        match token {
            StableToken::Solana(sol_token) => {
                verify_solana_liquidity_payment(args, amount, tx_id, signature, sol_token).await
            }
            _ => {
                Err("Only Solana tokens require signature verification for liquidity provision".to_string())
            }
        }
    }
}

/// Verify Solana payment for liquidity provision
async fn verify_solana_liquidity_payment(
    args: &AddLiquidityArgs,
    amount: &Nat,
    tx_id: &TxId,
    signature: &str,
    sol_token: &crate::stable_token::solana_token::SolanaToken,
) -> Result<LiquidityPaymentVerification, String> {
    // Extract transaction signature
    let tx_signature_str = match tx_id {
        TxId::TransactionId(hash) => hash.clone(),
        TxId::BlockIndex(_) => return Err("BlockIndex not supported for Solana transactions".to_string()),
    };

    // Check if this is an SPL token (not native SOL)
    let is_spl_token = sol_token.is_spl_token;
    
    // Extract sender from the transaction
    let sender_pubkey = extract_sender_from_transaction(&tx_signature_str, is_spl_token).await?;
    
    // Create canonical liquidity message and verify signature
    let canonical_message = CanonicalAddLiquidityMessage::from_add_liquidity_args(args);
    let message_to_verify = canonical_message.to_signing_message();
    
    verify_canonical_message(&message_to_verify, &sender_pubkey, signature)
        .map_err(|e| format!("Liquidity signature verification failed: {}", e))?;
    
    // Check timestamp freshness (5 minutes)
    let current_time_ms = ICNetwork::get_time() / 1_000_000;
    let message_timestamp = args.timestamp.unwrap_or(current_time_ms);
    let age_ms = current_time_ms.saturating_sub(message_timestamp);
    if age_ms > 300_000 {
        return Err(format!("Liquidity provision signature timestamp too old: {} ms", age_ms));
    }

    // Verify the actual Solana transaction
    let amount_u64 = amount.0.to_u64().ok_or("Amount too large")?;
    verify_solana_transaction(&tx_signature_str, &sender_pubkey, amount_u64, is_spl_token).await?;
    
    Ok(LiquidityPaymentVerification::SolanaPayment {
        tx_signature: tx_signature_str,
        from_address: sender_pubkey,
        amount: amount_u64,
    })
}

/// Extract sender public key from a Solana transaction
async fn extract_sender_from_transaction(tx_signature: &str, is_spl_token: bool) -> Result<String, String> {
    let transaction = get_solana_transaction(tx_signature.to_string())
        .ok_or_else(|| format!("Solana transaction {} not found. Make sure kong_rpc has processed this transaction.", tx_signature))?;
    
    // Parse metadata to extract sender
    if let Some(metadata_json) = &transaction.metadata {
        let metadata: serde_json::Value = serde_json::from_str(metadata_json)
            .map_err(|e| format!("Failed to parse transaction metadata: {}", e))?;
        
        // Extract sender based on token type
        let sender = if is_spl_token {
            // For SPL tokens: use "authority" or "sender_wallet" (the actual wallet that signed)
            metadata.get("authority")
                .or_else(|| metadata.get("sender_wallet"))
                .and_then(|v| v.as_str())
                .ok_or("SPL transaction metadata missing authority/sender_wallet information")?
        } else {
            // For native SOL: use "sender" (the wallet address)
            metadata.get("sender")
                .and_then(|v| v.as_str())
                .ok_or("SOL transaction metadata missing sender information")?
        };
            
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
    is_spl_token: bool,
) -> Result<(), String> {
    let transaction = get_solana_transaction(tx_signature.to_string())
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
        
        // Check sender matches based on token type
        let actual_sender = if is_spl_token {
            // For SPL tokens: use "authority" or "sender_wallet"
            metadata.get("authority")
                .or_else(|| metadata.get("sender_wallet"))
                .and_then(|v| v.as_str())
                .ok_or("SPL transaction metadata missing authority/sender_wallet information")?
        } else {
            // For native SOL: use "sender"
            metadata.get("sender")
                .and_then(|v| v.as_str())
                .ok_or("SOL transaction metadata missing sender information")?
        };
            
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