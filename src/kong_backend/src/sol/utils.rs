use crate::sol::sdk::pubkey::SolanaPubkey as Pubkey;
use crate::sol::sdk::signature::SolanaSignature as Signature;
use std::str::FromStr;
use bs58;

/// Error types for Solana utilities
#[derive(Debug)]
pub enum SolanaUtilsError {
    InvalidPublicKey(String),
    InvalidSignature(String),
    EncodingError(String),
    DecodingError(String),
}

/// Convert a Solana public key string to a Pubkey
pub fn string_to_pubkey(pubkey_str: &str) -> Result<Pubkey, SolanaUtilsError> {
    match Pubkey::from_str(pubkey_str) {
        Ok(pubkey) => Ok(pubkey),
        Err(e) => Err(SolanaUtilsError::InvalidPublicKey(
            format!("Invalid public key: {}", e),
        )),
    }
}

/// Convert a Pubkey to its string representation
pub fn pubkey_to_string(pubkey: &Pubkey) -> String {
    pubkey.to_string()
}

/// Convert a signature string to a Solana Signature
pub fn string_to_signature(signature_str: &str) -> Result<Signature, SolanaUtilsError> {
    match Signature::from_str(signature_str) {
        Ok(signature) => Ok(signature),
        Err(e) => Err(SolanaUtilsError::InvalidSignature(
            format!("Invalid signature: {}", e),
        )),
    }
}

/// Convert a Signature to its string representation
pub fn signature_to_string(signature: &Signature) -> String {
    signature.to_string()
}

/// Encode bytes to Base58 format (commonly used in Solana)
pub fn encode_bs58(bytes: &[u8]) -> String {
    bs58::encode(bytes).into_string()
}

/// Decode a Base58 string to bytes
pub fn decode_bs58(encoded: &str) -> Result<Vec<u8>, SolanaUtilsError> {
    match bs58::decode(encoded).into_vec() {
        Ok(bytes) => Ok(bytes),
        Err(e) => Err(SolanaUtilsError::DecodingError(
            format!("Failed to decode Base58: {}", e),
        )),
    }
}

/// Convert lamports to SOL
pub fn lamports_to_sol(lamports: u64) -> f64 {
    lamports as f64 / 1_000_000_000.0
}

/// Convert SOL to lamports
pub fn sol_to_lamports(sol: f64) -> u64 {
    (sol * 1_000_000_000.0) as u64
}