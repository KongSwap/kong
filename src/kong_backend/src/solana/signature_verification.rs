use anyhow::Result;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

use super::error::SolanaError;
use super::network::SolanaNetwork;

/// Verify an Ed25519 signature for a message
pub fn verify_ed25519_signature(
    message: &[u8],
    signature: &[u8],
    public_key: &str,
) -> Result<bool> {
    // Decode the public key from base58
    let public_key_bytes = SolanaNetwork::bs58_decode_public_key(public_key)?;
    
    // Create a verifying key from the public key bytes
    let verifying_key = VerifyingKey::from_bytes(&public_key_bytes)
        .map_err(|_| SolanaError::InvalidPublicKeyFormat("Invalid Ed25519 public key".to_string()))?;
    
    // Validate signature is 64 bytes
    if signature.len() != 64 {
        return Err(SolanaError::InvalidSignature("Signature must be 64 bytes".to_string()).into());
    }
    
    // Create signature from bytes - handle conversion error properly
    let signature_array: [u8; 64] = signature.try_into()
        .map_err(|_| SolanaError::InvalidSignature("Failed to convert signature to 64-byte array".to_string()))?;
    let signature = Signature::from_bytes(&signature_array);
    
    // Verify the signature
    Ok(verifying_key.verify(message, &signature).is_ok())
}

/// Canonical swap message for signing/verification
#[derive(Debug, Clone)]
pub struct CanonicalSwapMessage {
    pub pay_token: String,
    pub pay_amount: u64,
    pub pay_address: String,
    pub receive_token: String,
    pub receive_amount: u64,
    pub receive_address: String,
    pub max_slippage: f64,
    pub timestamp: u64,
    pub referred_by: Option<String>,
}

impl CanonicalSwapMessage {
    /// Serialize to bytes for signing/verification
    pub fn to_bytes(&self) -> Vec<u8> {
        // Create a deterministic string representation
        let message = format!(
            "KongSwap Swap Request:\n\
            Pay Token: {}\n\
            Pay Amount: {}\n\
            Pay Address: {}\n\
            Receive Token: {}\n\
            Receive Amount: {}\n\
            Receive Address: {}\n\
            Max Slippage: {}\n\
            Timestamp: {}\n\
            Referred By: {}",
            self.pay_token,
            self.pay_amount,
            self.pay_address,
            self.receive_token,
            self.receive_amount,
            self.receive_address,
            self.max_slippage,
            self.timestamp,
            self.referred_by.as_deref().unwrap_or("None")
        );
        
        message.into_bytes()
    }
    
    /// Verify the message is recent (within 5 minutes)
    pub fn verify_timestamp(&self, current_time: u64) -> Result<()> {
        const FIVE_MINUTES_NANOS: u64 = 5 * 60 * 1_000_000_000;
        
        if current_time < self.timestamp {
            return Err(SolanaError::InvalidTransaction("Timestamp is in the future".to_string()).into());
        }
        
        if current_time - self.timestamp > FIVE_MINUTES_NANOS {
            return Err(SolanaError::InvalidTransaction("Timestamp is too old (> 5 minutes)".to_string()).into());
        }
        
        Ok(())
    }
}