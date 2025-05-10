use candid::{CandidType, Deserialize};
use serde::Serialize;
use std::error::Error;
use std::fmt;

/// Error types for Solana address operations
#[derive(Debug, CandidType, Serialize, Deserialize)]
pub enum SolanaError {
    /// Error when retrieving the public key from the management canister
    PublicKeyRetrievalError(String),
    /// Error when the public key has an invalid format
    InvalidPublicKeyFormat(String),
    /// Error when encoding the address
    EncodingError(String),
    /// Error when validating network parameters
    NetworkValidationError(String),
    /// Error when making RPC calls
    RpcError(String),
    /// Error when processing transactions
    TransactionError(String),
    /// Error when building transactions
    TransactionBuildError(String),
    /// Error when signing transactions
    TransactionSignError(String),
    /// Token account not found
    TokenAccountNotFound(String),
    /// Error getting token balance
    TokenBalanceError(String),
    /// Error with token metadata
    TokenMetadataError(String),
    /// Error creating token account
    TokenAccountCreationError(String),
    /// Error with blockhash
    BlockhashError(String),
    /// Error with message signing
    InvalidMessageSigning(String),
    /// Error with invalid signature
    InvalidSignature(String),
    /// Error with invalid transaction
    InvalidTransaction(String),
    /// Error with RPC response
    RpcResponseError(String),
    /// Error with invalid response structure
    InvalidResponse(String),
}

// Implementing the Error trait for SolanaError without adding custom behavior.
// This allows SolanaError to be used as a standard error type.
impl Error for SolanaError {}

impl fmt::Display for SolanaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SolanaError::PublicKeyRetrievalError(msg) => {
                write!(f, "Public key retrieval error: {}", msg)
            }
            SolanaError::InvalidPublicKeyFormat(msg) => {
                write!(f, "Invalid public key format: {}", msg)
            }
            SolanaError::EncodingError(msg) => write!(f, "Encoding error: {}", msg),
            SolanaError::NetworkValidationError(msg) => {
                write!(f, "Network validation error: {}", msg)
            }
            SolanaError::RpcError(msg) => write!(f, "RPC error: {}", msg),
            SolanaError::TransactionError(msg) => write!(f, "Transaction error: {}", msg),
            SolanaError::TransactionBuildError(msg) => {
                write!(f, "Transaction build error: {}", msg)
            }
            SolanaError::TransactionSignError(msg) => {
                write!(f, "Transaction signing error: {}", msg)
            }
            SolanaError::TokenAccountNotFound(msg) => {
                write!(f, "Token account not found: {}", msg)
            }
            SolanaError::TokenBalanceError(msg) => write!(f, "Token balance error: {}", msg),
            SolanaError::TokenMetadataError(msg) => {
                write!(f, "Token metadata error: {}", msg)
            }
            SolanaError::TokenAccountCreationError(msg) => {
                write!(f, "Token account creation error: {}", msg)
            }
            SolanaError::BlockhashError(msg) => write!(f, "Blockhash error: {}", msg),
            SolanaError::InvalidMessageSigning(msg) => {
                write!(f, "Invalid message signing: {}", msg)
            }
            SolanaError::InvalidSignature(msg) => write!(f, "Invalid signature: {}", msg),
            SolanaError::InvalidTransaction(msg) => {
                write!(f, "Invalid transaction: {}", msg)
            }
            SolanaError::RpcResponseError(msg) => {
                write!(f, "RPC response error: {}", msg)
            }
            SolanaError::InvalidResponse(msg) => {
                write!(f, "Invalid response structure: {}", msg)
            }
        }
    }
}

impl From<SolanaError> for String {
    fn from(error: SolanaError) -> Self {
        error.to_string()
    }
}