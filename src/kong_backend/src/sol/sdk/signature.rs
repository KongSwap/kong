use candid::CandidType;
use serde::{de::{self, Deserializer, Visitor, SeqAccess}, ser::Serializer, Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

/// Represents a Solana signature
#[derive(Debug, Clone, Copy, CandidType, PartialEq, Eq)]
pub struct SolanaSignature {
    pub bytes: [u8; 64],
}

impl SolanaSignature {
    pub fn new(bytes_slice: &[u8]) -> Result<Self, &'static str> {
        if bytes_slice.len() != 64 {
            return Err("Signature must be 64 bytes");
        }
        
        let mut signature_array = [0u8; 64];
        signature_array.copy_from_slice(bytes_slice);
        
        Ok(Self { bytes: signature_array })
    }

    pub fn to_bytes(&self) -> [u8; 64] {
        self.bytes
    }

    pub fn verify(&self, _public_key: &crate::sol::sdk::pubkey::SolanaPubkey, _message: &[u8]) -> bool {
        // In a real implementation, this would validate the signature
        // For now, just return true as we're building a minimal implementation
        true
    }
}

impl fmt::Display for SolanaSignature {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", bs58::encode(&self.bytes).into_string())
    }
}

impl AsRef<[u8]> for SolanaSignature {
    fn as_ref(&self) -> &[u8] {
        &self.bytes
    }
}

impl Serialize for SolanaSignature {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        // Serialize as a byte array directly. This is efficient for binary formats.
        // For text formats like JSON, it might become an array of numbers or a base64 string
        // depending on the serializer's capabilities and options.
        // `serialize_bytes` is generally preferred for `&[u8]`.
        serializer.serialize_bytes(&self.bytes)
    }
}

impl<'de> Deserialize<'de> for SolanaSignature {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct SolanaSignatureVisitor;

        impl<'de> Visitor<'de> for SolanaSignatureVisitor {
            type Value = SolanaSignature;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a byte array of length 64")
            }

            // This method is called if the deserializer encounters actual bytes.
            fn visit_bytes<E>(self, v: &[u8]) -> Result<SolanaSignature, E>
            where
                E: de::Error,
            {
                if v.len() == 64 {
                    let mut bytes = [0u8; 64];
                    bytes.copy_from_slice(v);
                    Ok(SolanaSignature { bytes })
                } else {
                    Err(de::Error::invalid_length(v.len(), &self))
                }
            }
            
            // This method is called if the deserializer encounters a sequence (e.g. JSON array of numbers).
            fn visit_seq<A>(self, mut seq: A) -> Result<SolanaSignature, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let mut bytes = [0u8; 64];
                for i in 0..64 {
                    bytes[i] = seq.next_element()?
                        .ok_or_else(|| de::Error::invalid_length(i, &self))?;
                }
                // Optionally, ensure no more elements if strict about sequence length
                if seq.next_element::<u8>()?.is_some() {
                     return Err(de::Error::invalid_length(65, &self)); // Or some other number > 64
                }
                Ok(SolanaSignature { bytes })
            }
        }

        // For fixed-size arrays, `deserialize_tuple` is the most semantically correct.
        // The `SolanaSignatureVisitor`'s `visit_seq` method will be called.
        deserializer.deserialize_tuple(64, SolanaSignatureVisitor)
    }
}

impl FromStr for SolanaSignature {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let bytes = bs58::decode(s)
            .into_vec()
            .map_err(|e| format!("Failed to decode base58 signature: {}", e))?;

        if bytes.len() == 64 {
            let mut arr = [0u8; 64];
            arr.copy_from_slice(&bytes);
            Ok(SolanaSignature { bytes: arr })
        } else {
            Err(format!(
                "Invalid signature length: expected 64, got {}",
                bytes.len()
            ))
        }
    }
}