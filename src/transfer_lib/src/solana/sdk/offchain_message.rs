use anyhow::Result;
use num_enum::{IntoPrimitive, TryFromPrimitive};
use thiserror::Error;

use super::pubkey::Pubkey;
use super::signature::Signature;

#[derive(Error, PartialEq, Debug, Eq, Clone)]
pub enum SanitizeError {
    #[error("Index out of bounds")]
    IndexOutOfBounds,

    #[error("Value out of bounds")]
    ValueOutOfBounds,

    #[error("Invalid value")]
    InvalidValue,
}

/// Maximum over-the-wire size of a Transaction
///   1280 is IPv6 minimum MTU
///   40 bytes is the size of the IPv6 header
///   8 bytes is the size of the fragment header
pub const PACKET_DATA_SIZE: usize = 1280 - 40 - 8;

/// Check if given bytes contain only printable ASCII characters
pub fn is_printable_ascii(data: &[u8]) -> bool {
    for &char in data {
        if !(0x20..=0x7e).contains(&char) {
            return false;
        }
    }
    true
}

/// Check if given bytes contain valid UTF8 string
pub fn is_utf8(data: &[u8]) -> bool {
    std::str::from_utf8(data).is_ok()
}

#[repr(u8)]
#[derive(Debug, PartialEq, Eq, Copy, Clone, TryFromPrimitive, IntoPrimitive)]
pub enum MessageFormat {
    RestrictedAscii,
    LimitedUtf8,
    ExtendedUtf8,
}

#[allow(clippy::arithmetic_side_effects)]
pub mod v0 {
    use super::{
        is_printable_ascii, is_utf8, MessageFormat, OffchainMessage as Base, SanitizeError,
        PACKET_DATA_SIZE,
    };

    /// OffchainMessage Version 0.
    /// Struct always contains a non-empty valid message.
    #[derive(Debug, PartialEq, Eq, Clone)]
    pub struct OffchainMessage {
        format: MessageFormat,
        message: Vec<u8>,
    }

    impl OffchainMessage {
        // Header Length = Message Format (1) + Message Length (2)
        pub const HEADER_LEN: usize = 3;
        // Max length of the OffchainMessage
        pub const MAX_LEN: usize = u16::MAX as usize - Base::HEADER_LEN - Self::HEADER_LEN;
        // Max Length of the OffchainMessage supported by the Ledger
        pub const MAX_LEN_LEDGER: usize = PACKET_DATA_SIZE - Base::HEADER_LEN - Self::HEADER_LEN;

        /// Construct a new OffchainMessage object from the given message
        pub fn new(message: &[u8]) -> Result<Self, SanitizeError> {
            let format = if message.is_empty() {
                Err(SanitizeError::InvalidValue)?
            } else if message.len() <= OffchainMessage::MAX_LEN_LEDGER {
                if is_printable_ascii(message) {
                    MessageFormat::RestrictedAscii
                } else if is_utf8(message) {
                    MessageFormat::LimitedUtf8
                } else {
                    Err(SanitizeError::InvalidValue)?
                }
            } else if message.len() <= OffchainMessage::MAX_LEN {
                if is_utf8(message) {
                    MessageFormat::ExtendedUtf8
                } else {
                    Err(SanitizeError::InvalidValue)?
                }
            } else {
                Err(SanitizeError::ValueOutOfBounds)?
            };
            Ok(Self {
                format,
                message: message.to_vec(),
            })
        }

        /// Serialize the message to bytes, including the full header
        pub fn serialize(&self, data: &mut Vec<u8>) -> Result<(), SanitizeError> {
            // invalid messages shouldn't be possible, but a quick sanity check never hurts
            assert!(!self.message.is_empty() && self.message.len() <= Self::MAX_LEN);
            data.reserve(Self::HEADER_LEN.saturating_add(self.message.len()));
            // format
            data.push(self.format.into());
            // message length
            data.extend_from_slice(&(self.message.len() as u16).to_le_bytes());
            // message
            data.extend_from_slice(&self.message);
            Ok(())
        }

        /// Deserialize the message from bytes that include a full header
        pub fn deserialize(data: &[u8]) -> Result<Self, SanitizeError> {
            // validate data length
            if data.len() <= Self::HEADER_LEN || data.len() > Self::HEADER_LEN + Self::MAX_LEN {
                Err(SanitizeError::ValueOutOfBounds)?
            }
            // decode header
            let format =
                MessageFormat::try_from(data[0]).map_err(|_| SanitizeError::InvalidValue)?;
            let message_len = u16::from_le_bytes([data[1], data[2]]) as usize;
            // check header
            if Self::HEADER_LEN.saturating_add(message_len) != data.len() {
                Err(SanitizeError::InvalidValue)?
            }
            let message = &data[Self::HEADER_LEN..];
            // check format
            let is_valid = match format {
                MessageFormat::RestrictedAscii => {
                    (message.len() <= Self::MAX_LEN_LEDGER) && is_printable_ascii(message)
                }
                MessageFormat::LimitedUtf8 => {
                    (message.len() <= Self::MAX_LEN_LEDGER) && is_utf8(message)
                }
                MessageFormat::ExtendedUtf8 => (message.len() <= Self::MAX_LEN) && is_utf8(message),
            };

            if is_valid {
                Ok(Self {
                    format,
                    message: message.to_vec(),
                })
            } else {
                Err(SanitizeError::InvalidValue)?
            }
        }
    }
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum OffchainMessage {
    V0(v0::OffchainMessage),
}

impl OffchainMessage {
    pub const SIGNING_DOMAIN: &'static [u8] = b"\xffsolana offchain";
    // Header Length = Signing Domain (16) + Header Version (1)
    pub const HEADER_LEN: usize = Self::SIGNING_DOMAIN.len() + 1;

    /// Construct a new OffchainMessage object from the given version and message
    pub fn new(version: u8, message: &[u8]) -> Result<Self, SanitizeError> {
        match version {
            0 => Ok(Self::V0(v0::OffchainMessage::new(message)?)),
            _ => Err(SanitizeError::ValueOutOfBounds)?,
        }
    }

    /// Serialize the off-chain message to bytes including full header
    pub fn serialize(&self) -> Result<Vec<u8>, SanitizeError> {
        // serialize signing domain
        let mut data = Self::SIGNING_DOMAIN.to_vec();

        // serialize version and call version specific serializer
        match self {
            Self::V0(msg) => {
                data.push(0);
                msg.serialize(&mut data)?;
            }
        }
        Ok(data)
    }

    /// Deserialize the off-chain message from bytes that include full header
    pub fn deserialize(data: &[u8]) -> Result<Self, SanitizeError> {
        if data.len() <= Self::HEADER_LEN {
            Err(SanitizeError::ValueOutOfBounds)?
        }
        let version = data[Self::SIGNING_DOMAIN.len()];
        let data = &data[Self::SIGNING_DOMAIN.len().saturating_add(1)..];
        match version {
            0 => Ok(Self::V0(v0::OffchainMessage::deserialize(data)?)),
            _ => Err(SanitizeError::ValueOutOfBounds)?,
        }
    }

    /// Verify that the message signature is valid for the given public key
    pub fn verify(&self, signer: &Pubkey, signature: &Signature) -> Result<bool> {
        let verify_key = ed25519_dalek::VerifyingKey::from_bytes(&signer.to_bytes())?;
        // convert Solana signature to ed25519_dalek signature
        let ed25519_signature = signature.as_ref().try_into()?;
        verify_key.verify_strict(&self.serialize()?, &ed25519_signature)?;
        Ok(true)
    }
}
