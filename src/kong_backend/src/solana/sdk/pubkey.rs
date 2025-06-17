use std::{
    fmt, mem,
    str::{from_utf8, FromStr},
};

use crate::solana::error::SolanaError;

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
        let mut out = [0u8; MAX_BASE58_LEN];
        let out_slice: &mut [u8] = &mut out;
        // This will never fail because the only possible error is BufferTooSmall,
        // and we will never call it with too small a buffer.
        let len = bs58::encode(self.0).onto(out_slice).unwrap();
        let as_str = from_utf8(&out[..len]).unwrap();
        f.write_str(as_str)
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
        let mut bytes = [0; PUBKEY_BYTES];
        let decoded_size = bs58::decode(s).onto(&mut bytes).map_err(|_| {
            SolanaError::InvalidPublicKeyFormat("Pubkey is wrong base58 format".to_string())
        })?;
        if decoded_size != mem::size_of::<Pubkey>() {
            return Err(SolanaError::InvalidPublicKeyFormat(
                "Pubkey is wrong size".to_string(),
            ));
        }

        Ok(Pubkey(bytes))
    }
}
