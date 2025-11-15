use std::{
    fmt,
    str::FromStr,
};

use crate::solana::error::SolanaError;
use crate::solana::utils::base58;

/// Number of bytes in a pubkey
pub const PUBKEY_BYTES: usize = 32;
/// Maximum string length of a base58 encoded pubkey
const MAX_BASE58_LEN: usize = 44;

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Pubkey([u8; 32]);

impl Pubkey {
    pub const fn new(bytes: [u8; 32]) -> Self {
        Pubkey(bytes)
    }
    
    pub const fn to_bytes(&self) -> [u8; 32] {
        self.0
    }

    fn write_as_base58(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str(&base58::encode(&self.0))
    }
}

impl fmt::Debug for Pubkey {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        self.write_as_base58(f)
    }
}

impl fmt::Display for Pubkey {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        self.write_as_base58(f)
    }
}

impl FromStr for Pubkey {
    type Err = SolanaError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s.len() > MAX_BASE58_LEN {
            return Err(SolanaError::InvalidPublicKeyFormat(
                "Pubkey is wrong size".to_string(),
            ));
        }
        let bytes = base58::decode_public_key(s)?;
        Ok(Pubkey(bytes))
    }
}
