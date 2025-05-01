use {
    ed25519_dalek::{Signature, Verifier, VerifyingKey},
    serde::Serialize,
    std::{
        convert::{Infallible, TryFrom},
        fmt, mem,
        str::FromStr,
    },
    thiserror::Error,
};

const MAX_BASE58_LEN: usize = 44;

#[derive(Serialize, Clone, Copy)]
pub struct SolPubkey(pub(crate) [u8; 32]);

#[derive(Error, Debug, Serialize, Clone, PartialEq, Eq)]
pub enum ParsePubkeyError {
    #[error("String is the wrong size")]
    WrongSize,
    #[error("Invalid Base58 string")]
    Invalid,
}

impl fmt::Display for SolPubkey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let base58_str = bs58::encode(self.0).into_string();
        write!(f, "{}", base58_str)
    }
}

impl From<Infallible> for ParsePubkeyError {
    fn from(_: Infallible) -> Self {
        unreachable!("Infallible uninhabited");
    }
}

impl std::str::FromStr for SolPubkey {
    type Err = ParsePubkeyError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s.len() > MAX_BASE58_LEN {
            return Err(ParsePubkeyError::WrongSize);
        }
        let pubkey_vec = bs58::decode(s)
            .into_vec()
            .map_err(|_| ParsePubkeyError::Invalid)?;
        if pubkey_vec.len() != mem::size_of::<SolPubkey>() {
            Err(ParsePubkeyError::WrongSize)
        } else {
            SolPubkey::try_from(pubkey_vec.as_slice()).map_err(|_| ParsePubkeyError::Invalid)
        }
    }
}

impl From<[u8; 32]> for SolPubkey {
    #[inline]
    fn from(from: [u8; 32]) -> Self {
        Self(from)
    }
}

impl TryFrom<&[u8]> for SolPubkey {
    type Error = std::array::TryFromSliceError;

    #[inline]
    fn try_from(pubkey: &[u8]) -> Result<Self, Self::Error> {
        <[u8; 32]>::try_from(pubkey).map(Self::from)
    }
}

impl TryFrom<Vec<u8>> for SolPubkey {
    type Error = Vec<u8>;

    #[inline]
    fn try_from(pubkey: Vec<u8>) -> Result<Self, Self::Error> {
        <[u8; 32]>::try_from(pubkey).map(Self::from)
    }
}

impl TryFrom<&str> for SolPubkey {
    type Error = ParsePubkeyError;
    fn try_from(s: &str) -> Result<Self, Self::Error> {
        SolPubkey::from_str(s)
    }
}

impl SolPubkey {
    pub fn to_bytes(self) -> [u8; 32] {
        self.0
    }
}

#[derive(Error, Debug, Serialize, Clone, PartialEq, Eq)]
pub enum ParseSolSignatureError {
    #[error("String is the wrong size")]
    WrongSize,
    #[error("Invalid Base58 string")]
    Invalid,
}

pub struct SolSignature(pub(crate) [u8; 64]);

impl TryFrom<Vec<u8>> for SolSignature {
    type Error = ParseSolSignatureError;

    fn try_from(value: Vec<u8>) -> Result<Self, Self::Error> {
        if value.len() != mem::size_of::<SolSignature>() {
            // Ensure the byte array is exactly 64 bytes
            Err(ParseSolSignatureError::WrongSize)
        } else {
            let mut bytes = [0u8; 64];
            bytes.copy_from_slice(&value[0..64]);
            Ok(SolSignature(bytes))
        }
    }
}

impl std::str::FromStr for SolSignature {
    type Err = ParseSolSignatureError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let signature_vec = bs58::decode(s)
            .into_vec()
            .map_err(|_| ParseSolSignatureError::Invalid)?;
        if signature_vec.len() != mem::size_of::<SolSignature>() {
            // Match against the correct size for Solana signatures
            Err(ParseSolSignatureError::WrongSize)
        } else {
            SolSignature::try_from(signature_vec).map_err(|_| ParseSolSignatureError::Invalid)
        }
    }
}

pub enum SolError {
    InvalidPubkey,
    InvalidSignature,
    VerificationFailure,
}

impl fmt::Display for SolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SolError::InvalidPubkey => write!(f, "Invalid public key"),
            SolError::InvalidSignature => write!(f, "Invalid signature"),
            SolError::VerificationFailure => write!(f, "Signature verification failed"),
        }
    }
}

impl From<SolError> for String {
    fn from(error: SolError) -> Self {
        error.to_string()
    }
}

pub fn verify_sol_signature(
    message: &str,
    signature: &SolSignature,
    pubkey: &SolPubkey,
) -> Result<bool, SolError> {
    // Create a VerifyingKey from the Solana public key bytes
    let verifying_key = VerifyingKey::from_bytes(&pubkey.0)
        .map_err(|_| SolError::InvalidPubkey)?;

    // Create a Signature from the Solana signature bytes
    let signature = Signature::from_bytes(&signature.0)
        .try_into()
        .map_err(|_| SolError::InvalidSignature)?;

    // Verify the signature
    verifying_key
        .verify(message.as_bytes(), &signature)
        .map(|_| true) // If verification is successful, map Ok(()) to true
        .map_err(|_| SolError::VerificationFailure) // Handle any verification failure
}
