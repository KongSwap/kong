//! Solana transfer verification module
//! Handles verification of Solana/SPL token transfers by checking signatures and on-chain transactions

use anyhow::Result;
use candid::Nat;
use num_traits::ToPrimitive;
use std::str::FromStr;

use kong_lib::ic::network::ICNetwork;
use crate::solana::stable_memory::get_solana_transaction;
use crate::solana::kong_rpc::transaction_notification::{TransactionNotification, TransactionNotificationStatus};
use crate::solana::stable_memory::get_cached_solana_address;
use kong_lib::stable_token::stable_token::StableToken;
use super::error::SolanaError;
use super::network::{SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID};
use super::sdk::offchain_message::OffchainMessage;
use super::sdk::pubkey::Pubkey;
use super::sdk::signature::Signature as SolanaSignature;

/// Result of Solana transfer verification
#[derive(Debug, Clone)]
pub struct SolanaVerificationResult {
    pub tx_signature: String,
    pub from_address: String,
    pub amount: Nat,
}

/// Verify a Solana transfer by checking signature and on-chain transaction
///
/// # Arguments
/// * `tx_id` - The transaction signature/ID
/// * `signature` - The Ed25519 signature on the canonical message
/// * `amount` - The expected transfer amount
/// * `canonical_message` - The message that was signed (without sender, as it will be extracted)
/// * `expected_token` - The expected token (contains mint_address for SPL tokens)
/// * `is_spl_token` - Whether this is an SPL token (true) or native SOL (false)
///
/// # Returns
/// * `Ok(SolanaVerificationResult)` - If verification succeeds
/// * `Err(String)` - If verification fails with reason
pub async fn verify_transfer(
    tx_id: &str,
    signature: &str,
    amount: &Nat,
    canonical_message: &str,
    expected_token: &StableToken, // TODO: SolanaToken
    is_spl_token: bool,
) -> Result<SolanaVerificationResult, String> {
    // Get transaction and parse metadata once
    let transaction = get_solana_transaction(tx_id).ok_or_else(|| {
        format!(
            "Solana transaction {} not found. Make sure kong_rpc has processed this transaction.",
            tx_id
        )
    })?;
    
    // Security check: Ensure transaction was marked as successful by kong_rpc
    // Failed transactions should never have made it this far
    if transaction.status == TransactionNotificationStatus::Failed {
        return Err(format!(
            "Transaction {} was marked as failed by kong_rpc. Cannot use for deposit.",
            tx_id
        ));
    }

    let metadata_json = transaction.metadata.as_ref()
        .ok_or("Transaction metadata is missing")?;
    
    let metadata: serde_json::Value = serde_json::from_str(metadata_json)
        .map_err(|e| format!("Failed to parse transaction metadata: {}", e))?;

    // Extract sender from the parsed metadata
    let sender_pubkey = extract_solana_sender_from_metadata(&metadata, is_spl_token)?;
    
    ic_cdk::println!("canonical message: {}; signature={}", canonical_message, signature);
    // Verify the signature on the canonical message
    // The message should already contain the pay_address that matches the sender
    verify_canonical_message(canonical_message, &sender_pubkey, signature)
        .map_err(|e| format!("Signature verification failed: {}", e))?;
    
    // NEW SECURITY VALIDATIONS
    
    // 1. Validate receiver address matches Kong's expected address
    validate_receiver_address(&metadata, expected_token)?;
    
    // 2. Validate program ID matches expected token type
    validate_program_id(&metadata, is_spl_token)?;
    
    // 3. Validate mint address for SPL tokens
    validate_mint_address(&metadata, expected_token)?;
    
    // Verify the actual Solana transaction on-chain using the parsed metadata
    verify_solana_transaction_with_metadata(&transaction, &metadata, &sender_pubkey, amount, is_spl_token)?;
    
    Ok(SolanaVerificationResult {
        tx_signature: tx_id.to_string(),
        from_address: sender_pubkey,
        amount: amount.clone(),
    })
}

/// Extract sender from parsed metadata based on token type
fn extract_solana_sender_from_metadata(metadata: &serde_json::Value, is_spl_token: bool) -> Result<String, String> {
    // Extract sender based on token type
    let sender = if is_spl_token {
        // For SPL tokens: use "authority" or "sender_wallet" (the actual wallet that signed)
        metadata
            .get("authority")
            .or_else(|| metadata.get("sender_wallet"))
            .and_then(|v| v.as_str())
            .ok_or("SPL transaction metadata missing authority/sender_wallet information")?
    } else {
        // For native SOL: use "sender" (the wallet address)
        metadata
            .get("sender")
            .and_then(|v| v.as_str())
            .ok_or("SOL transaction metadata missing sender information")?
    };

    Ok(sender.to_string())
}

/// Verify a Solana transaction exists and matches expected parameters using pre-parsed metadata
fn verify_solana_transaction_with_metadata(
    transaction: &TransactionNotification,
    metadata: &serde_json::Value,
    expected_sender: &str,
    expected_amount: &Nat,
    is_spl_token: bool,
) -> Result<(), String> {
    // Check transaction status
    match transaction.status {
        TransactionNotificationStatus::Confirmed | TransactionNotificationStatus::Finalized => {} // Good statuses
        TransactionNotificationStatus::Failed => return Err("Solana transaction failed".to_string()),
        TransactionNotificationStatus::Processed => return Err("Solana transaction still being processed".to_string()),
    }

    // Verify blockchain timestamp freshness (5 minute window)
    // Solana transactions must be recent to prevent replay attacks with old transactions
    const MAX_TRANSACTION_AGE_MS: u64 = 300_000; // 5 minutes in milliseconds

    // Extract blockTime from metadata (unix timestamp in seconds from Solana RPC)
    let block_time = metadata
        .get("blockTime")
        .and_then(|v| v.as_u64())
        .ok_or("Solana transaction missing transaction blockTime")?;

    // Convert to milliseconds and check age
    let tx_timestamp_ms = block_time * 1000;
    let current_time_ms = ICNetwork::get_time() / 1_000_000; // Convert from nanoseconds
    let age_ms = current_time_ms.saturating_sub(tx_timestamp_ms);

    if age_ms > MAX_TRANSACTION_AGE_MS {
        return Err(format!(
            "Solana transaction is too old: {} minutes ago. Transactions must be less than {} minutes old.",
            age_ms / 60_000,
            MAX_TRANSACTION_AGE_MS / 60_000
        ));
    }

    // Verify transaction details using the already parsed metadata
    
    // Check sender matches based on token type
    let actual_sender = if is_spl_token {
        // For SPL tokens: use "authority" or "sender_wallet"
        metadata
            .get("authority")
            .or_else(|| metadata.get("sender_wallet"))
            .and_then(|v| v.as_str())
            .ok_or("SPL transaction metadata missing authority/sender_wallet information")?
    } else {
        // For native SOL: use "sender"
        metadata
            .get("sender")
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
    let actual_amount = metadata
        .get("amount")
        .and_then(|v| v.as_u64())
        .ok_or("Transaction metadata missing amount")?;

    // API boundary: Solana returns u64 amounts, so we must convert for comparison
    let expected_amount_u64 = expected_amount
        .0
        .to_u64()
        .ok_or("Expected amount too large for Solana (max ~18.4e18)")?;
    if actual_amount != expected_amount_u64 {
        return Err(format!(
            "Transaction amount mismatch. Expected: {}, Got: {}",
            expected_amount_u64, actual_amount
        ));
    }

    Ok(())
}

fn verify_raw_message(message: &str, pubkey: &Pubkey, signature: &SolanaSignature) -> Result<()> {
    let verify_key = ed25519_dalek::VerifyingKey::from_bytes(&pubkey.to_bytes())?;
    let ed25519_signature = signature.as_ref().try_into()?;
    verify_key.verify_strict(message.as_bytes(), &ed25519_signature)?;
    Ok(())
}

/// Verify a signature against a canonical message
///
/// This unified flow accepts both raw signatures and Solana CLI prefixed signatures.
/// It tries raw signature verification first (most common in production),
/// then falls back to prefixed signature verification if needed.
///
/// Note: The Solana CLI adds a "\xffsolana offchain" prefix when signing messages.
pub fn verify_canonical_message(message: &str, public_key: &str, signature: &str) -> Result<()> {
    let pubkey = Pubkey::from_str(public_key)?;
    let sig = SolanaSignature::from_str(signature)?;

    // Try raw signature first (most common case)
    // Wallets like Phantom and Solflare sign the raw message directly
    if verify_raw_message(message, &pubkey, &sig).is_ok() {
        return Ok(());
    }

    // If raw verification fails, try with Solana's offchain message prefix
    // The Solana CLI and some developer tools add this prefix when signing
    let offchain_message = OffchainMessage::new(0, message.as_bytes())
        .map_err(|e| SolanaError::InvalidMessageSigning(format!("Failed to create offchain message: {}", e)))?;

    offchain_message
        .verify(&pubkey, &sig)
        .map_err(|e| SolanaError::InvalidMessageSigning(format!("Invalid signature. Error: {}", e)))?;

    Ok(())
}

/// Extract sender from a Solana transaction based on token type
/// This is a compatibility wrapper that maintains the single metadata parsing goal
pub async fn extract_solana_sender_from_transaction(tx_signature: &str, is_spl_token: bool) -> Result<String, String> {
    let transaction = get_solana_transaction(tx_signature).ok_or_else(|| {
        format!(
            "Solana transaction {} not found. Make sure kong_rpc has processed this transaction.",
            tx_signature
        )
    })?;

    let metadata_json = transaction.metadata.as_ref()
        .ok_or("Transaction metadata is missing")?;
    
    let metadata: serde_json::Value = serde_json::from_str(metadata_json)
        .map_err(|e| format!("Failed to parse transaction metadata: {}", e))?;

    // Use the existing metadata extraction function
    extract_solana_sender_from_metadata(&metadata, is_spl_token)
}

/// Validate that the receiver address matches Kong's expected Solana address
fn validate_receiver_address(metadata: &serde_json::Value, expected_token: &StableToken) -> Result<(), String> {
    let receiver = metadata.get("receiver")
        .and_then(|v| v.as_str())
        .ok_or("Missing receiver in transaction metadata")?;
    
    let kong_address = get_cached_solana_address();
    let program_id = metadata.get("program_id").and_then(|v| v.as_str());
    
    // For SPL tokens, receiver is an ATA. We need to validate it's the correct ATA for Kong
    if program_id == Some(SPL_TOKEN_PROGRAM_ID) {
        if let StableToken::Solana(sol_token) = expected_token {
            if sol_token.is_spl_token {
                // Derive what the ATA should be for Kong's address and this mint
                let expected_ata = crate::solana::transaction::builder::TransactionBuilder::derive_associated_token_account(
                    &kong_address,
                    &sol_token.mint_address
                ).map_err(|e| format!("Failed to derive expected ATA: {}", e))?;
                
                if receiver != expected_ata {
                    return Err(format!(
                        "Invalid receiver ATA. Expected: {} (for Kong address {} and mint {}), Got: {}",
                        expected_ata, kong_address, sol_token.mint_address, receiver
                    ));
                }
            }
        }
    } else {
        // For native SOL, receiver should be Kong's address directly
        if receiver != kong_address {
            return Err(format!(
                "Invalid receiver address. Expected: {}, Got: {}",
                kong_address, receiver
            ));
        }
    }
    Ok(())
}

/// Validate that the program ID matches the expected token type
fn validate_program_id(metadata: &serde_json::Value, expected_is_spl: bool) -> Result<(), String> {
    let program_id = metadata.get("program_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing program_id in transaction metadata")?;
    
    let expected_program = if expected_is_spl {
        SPL_TOKEN_PROGRAM_ID
    } else {
        SYSTEM_PROGRAM_ID
    };
    
    if program_id != expected_program {
        return Err(format!(
            "Program ID mismatch. Expected {} transfer with program {}, got {}",
            if expected_is_spl { "SPL" } else { "SOL" },
            expected_program,
            program_id
        ));
    }
    Ok(())
}

/// Validate mint address for SPL tokens
fn validate_mint_address(metadata: &serde_json::Value, expected_token: &StableToken) -> Result<(), String> {
    if let StableToken::Solana(sol_token) = expected_token {
        if !sol_token.is_spl_token {
            return Ok(()); // Native SOL doesn't need mint validation
        }
        
        let actual_mint = metadata.get("mint_address")
            .and_then(|v| v.as_str())
            .ok_or("Missing mint_address for SPL token in transaction metadata")?;
        
        if actual_mint != sol_token.mint_address {
            return Err(format!(
                "Mint address mismatch. Expected token {} with mint {}, got {}",
                sol_token.symbol, sol_token.mint_address, actual_mint
            ));
        }
    }
    Ok(())
}

