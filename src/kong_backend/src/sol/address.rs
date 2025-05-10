use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::fmt;

use crate::ic::address::Address;

/// Represents a Solana public key (address)
#[derive(Debug, Clone, CandidType, Serialize, Deserialize, PartialEq, Eq)]
pub struct SolanaPublicKey(pub [u8; 32]);

impl fmt::Display for SolanaPublicKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Base58 encoding of the public key
        write!(f, "{}", bs58::encode(&self.0).into_string())
    }
}

impl SolanaPublicKey {
    /// Create a new SolanaPublicKey from a base58 string
    pub fn from_base58(s: &str) -> Result<Self, String> {
        let decoded = bs58::decode(s)
            .into_vec()
            .map_err(|e| format!("Invalid base58 encoding: {}", e))?;
        
        if decoded.len() != 32 {
            return Err(format!("Invalid public key length: {}, expected 32", decoded.len()));
        }
        
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&decoded);
        
        Ok(SolanaPublicKey(bytes))
    }
    
    /// Create a SolanaPublicKey from a principal ID
    /// Note: This is a deterministic derivation suitable for testing
    pub fn from_principal(principal: &Principal) -> Self {
        let principal_bytes = principal.as_slice();
        let mut bytes = [0u8; 32];
        
        // Copy principal bytes to the result (with padding if needed)
        let copy_len = std::cmp::min(principal_bytes.len(), 32);
        bytes[..copy_len].copy_from_slice(&principal_bytes[..copy_len]);
        
        SolanaPublicKey(bytes)
    }
}

/// Helper function to create a Solana address from a principal ID
pub fn principal_to_sol_address(principal: &Principal) -> String {
    let sol_pubkey = SolanaPublicKey::from_principal(principal);
    sol_pubkey.to_string()
}

/// Helper function to validate a Solana address
pub fn validate_sol_address(address: &str) -> Result<(), String> {
    // Try to parse as base58 encoded public key
    SolanaPublicKey::from_base58(address)?;
    Ok(())
}

/// Get Solana address from generic address
pub fn get_sol_address(address: &Address) -> Result<String, String> {
    match address {
        Address::PrincipalId(principal) => Ok(principal_to_sol_address(principal)),
        Address::AccountId(account_id) => Err(format!("Cannot convert IC Account ID to Solana address: {}", account_id)),
        Address::Raw(raw_address) => {
            validate_sol_address(raw_address)?;
            Ok(raw_address.to_string())
        }
    }
}

/// Convert address string to SolanaPublicKey
pub fn string_to_sol_pubkey(address: &str) -> Result<SolanaPublicKey, String> {
    SolanaPublicKey::from_base58(address)
}