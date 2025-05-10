use candid::{CandidType, Deserialize};
use serde::Serialize;
use std::error::Error;
use std::fmt;

/// Error types for Solana address operations
#[derive(Debug, CandidType, Serialize, Deserialize)]
pub enum ICError {
    /// Error when retrieving the Ed25519 public key from the management canister
    SchnorrPublicKeyError(String),
    /// Error when the signing message with Schnorr
    SchnorrSignatureError(String),
}

// Implementing the Error trait for ICError without adding custom behavior.
// This allows ICError to be used as a standard error type.
impl Error for ICError {}

impl fmt::Display for ICError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ICError::SchnorrPublicKeyError(msg) => {
                write!(f, "Ed25519 public key retrieval error: {}", msg)
            }
            ICError::SchnorrSignatureError(msg) => {
                write!(f, "Schnorr signature error: {}", msg)
            }
        }
    }
}

impl From<ICError> for String {
    fn from(error: ICError) -> Self {
        error.to_string()
    }
}