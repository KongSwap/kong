use super::super::error::SolanaError;
use super::base58;

/// Validate a Solana address is well-formed
pub fn validate_address(address: &str) -> Result<(), SolanaError> {
    // Decode and validate it's 32 bytes
    base58::decode_public_key(address)?;
    Ok(())
}

/// Validate multiple addresses
pub fn validate_addresses(addresses: &[&str]) -> Result<(), SolanaError> {
    for address in addresses {
        validate_address(address)?;
    }
    Ok(())
}