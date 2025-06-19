//! Message signature verification with support for both raw and prefixed signatures
//! 
//! This module handles signature verification with the following behavior:
//! - Mainnet: Only accepts raw signatures (for security and compatibility)
//! - Local: Accepts both raw signatures and Solana CLI prefixed signatures
//!   (The Solana CLI adds a "\xffsolana offchain" prefix when signing messages)

use anyhow::Result;
use std::str::FromStr;

use crate::solana::error::SolanaError;
use crate::solana::sdk::offchain_message::OffchainMessage;
use crate::solana::sdk::pubkey::Pubkey;
use crate::solana::sdk::signature::Signature;

/// Verify a signature against a raw message (without Solana's prefix)
fn verify_raw_message(
    message: &str,
    pubkey: &Pubkey,
    signature: &Signature,
) -> Result<()> {
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
pub fn verify_canonical_message(
    message: &str,
    public_key: &str,
    signature: &str,
) -> Result<()> {
    let pubkey = Pubkey::from_str(public_key)?;
    let sig = Signature::from_str(signature)?;
    
    // Try raw signature first (most common case)
    if verify_raw_message(message, &pubkey, &sig).is_ok() {
        return Ok(());
    }
    
    // If raw verification fails, try with Solana's offchain message prefix
    let offchain_message = OffchainMessage::new(0, message.as_bytes()).map_err(|e| {
        SolanaError::InvalidMessageSigning(format!("Failed to create offchain message: {}", e))
    })?;
    
    offchain_message.verify(&pubkey, &sig).map_err(|e| {
        SolanaError::InvalidMessageSigning(format!(
            "Invalid signature. Error: {}", e))
    })?;
    
    Ok(())
}