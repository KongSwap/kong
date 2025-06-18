use anyhow::Result;
use std::str::FromStr;

use crate::solana::error::SolanaError;
use crate::solana::utils::base58;

/// Number of bytes in a signature
pub const SIGNATURE_BYTES: usize = 64;
/// Maximum string length of a base58 encoded signature
const MAX_BASE58_SIGNATURE_LEN: usize = 88;

pub struct Signature([u8; SIGNATURE_BYTES]);

impl AsRef<[u8]> for Signature {
    fn as_ref(&self) -> &[u8] {
        &self.0[..]
    }
}

impl From<[u8; SIGNATURE_BYTES]> for Signature {
    #[inline]
    fn from(signature: [u8; SIGNATURE_BYTES]) -> Self {
        Self(signature)
    }
}

impl FromStr for Signature {
    type Err = SolanaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s.len() > MAX_BASE58_SIGNATURE_LEN {
            return Err(SolanaError::InvalidSignature(
                "Signature is wrong size".to_string(),
            ));
        }
        let bytes = base58::decode_signature(s)?;
        Ok(Signature(bytes))
    }
}
