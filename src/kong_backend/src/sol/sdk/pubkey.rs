use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

/// Represents a Solana public key
/// This replaces the dependency on ic_solana_rpc_client::solana_sdk::pubkey::Pubkey
#[derive(Debug, Clone, Copy, CandidType, Serialize, Deserialize, PartialEq, Eq)]
pub struct SolanaPubkey([u8; 32]);

impl SolanaPubkey {
    pub fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub fn new_from_array(bytes: [u8; 32]) -> Result<Self, &'static str> {
        Ok(Self(bytes))
    }

    pub fn to_bytes(&self) -> [u8; 32] {
        self.0
    }

    /// Create a pubkey from a base58 string
    pub fn from_base58(s: &str) -> Result<Self, String> {
        let decoded = bs58::decode(s)
            .into_vec()
            .map_err(|e| format!("Invalid base58 encoding: {}", e))?;
        
        if decoded.len() != 32 {
            return Err(format!("Invalid public key length: {}, expected 32", decoded.len()));
        }
        
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&decoded);
        
        Ok(Self(bytes))
    }
    
    /// Create a pubkey from a principal ID
    pub fn from_principal(principal: &Principal) -> Self {
        let principal_bytes = principal.as_slice();
        let mut bytes = [0u8; 32];
        
        // Copy principal bytes to the result (with padding if needed)
        let copy_len = std::cmp::min(principal_bytes.len(), 32);
        bytes[..copy_len].copy_from_slice(&principal_bytes[..copy_len]);
        
        Self(bytes)
    }
}

impl FromStr for SolanaPubkey {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::from_base58(s)
    }
}

impl fmt::Display for SolanaPubkey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", bs58::encode(&self.0).into_string())
    }
}

impl AsRef<[u8]> for SolanaPubkey {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}