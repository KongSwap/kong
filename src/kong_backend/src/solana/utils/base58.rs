use bs58;
use super::super::error::SolanaError;

/// Decode a base58-encoded public key into a 32-byte array
pub fn decode_public_key(public_key: &str) -> Result<[u8; 32], SolanaError> {
    let bytes = bs58::decode(public_key)
        .into_vec()
        .map_err(|_| SolanaError::InvalidPublicKeyFormat("Failed to decode base58".to_string()))?;
    
    if bytes.len() != 32 {
        return Err(SolanaError::InvalidPublicKeyFormat(
            format!("Expected 32 bytes, got {}", bytes.len())
        ));
    }
    
    let mut array = [0u8; 32];
    array.copy_from_slice(&bytes);
    Ok(array)
}

/// Decode a base58-encoded signature into a 64-byte array
pub fn decode_signature(signature: &str) -> Result<[u8; 64], SolanaError> {
    let bytes = bs58::decode(signature)
        .into_vec()
        .map_err(|_| SolanaError::InvalidSignature("Failed to decode base58".to_string()))?;
    
    if bytes.len() != 64 {
        return Err(SolanaError::InvalidSignature(
            format!("Expected 64 bytes, got {}", bytes.len())
        ));
    }
    
    let mut array = [0u8; 64];
    array.copy_from_slice(&bytes);
    Ok(array)
}

/// Encode bytes as base58 string
pub fn encode(bytes: &[u8]) -> String {
    bs58::encode(bytes).into_string()
}