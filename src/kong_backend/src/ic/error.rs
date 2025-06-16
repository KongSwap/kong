use candid::Deserialize;
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum ICError {
    #[error("Ed25519 public key retrieval error: {0}")]
    SchnorrPublicKeyError(String),

    #[error("Schnorr signature error: {0}")]
    SchnorrSignatureError(String),
}