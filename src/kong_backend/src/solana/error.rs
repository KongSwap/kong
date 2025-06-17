use candid::Deserialize;
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum SolanaError {
    #[error("Public key retrieval error: {0}")]
    PublicKeyRetrievalError(String),

    #[error("Invalid public key format: {0}")]
    InvalidPublicKeyFormat(String),

    #[error("Encoding error: {0}")]
    EncodingError(String),

    #[error("Network validation error: {0}")]
    NetworkValidationError(String),

    #[error("RPC error: {0}")]
    RpcError(String),

    #[error("Transaction error: {0}")]
    TransactionError(String),

    #[error("Transaction build error: {0}")]
    TransactionBuildError(String),

    #[error("Transaction signing error: {0}")]
    TransactionSignError(String),

    #[error("Token account not found: {0}")]
    TokenAccountNotFound(String),

    #[error("Token balance error: {0}")]
    TokenBalanceError(String),

    #[error("Token metadata error: {0}")]
    TokenMetadataError(String),

    #[error("Token account creation error: {0}")]
    TokenAccountCreationError(String),

    #[error("Blockhash error: {0}")]
    BlockhashError(String),

    #[error("Invalid message signing: {0}")]
    InvalidMessageSigning(String),

    #[error("Invalid signature: {0}")]
    InvalidSignature(String),

    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),

    #[error("RPC response error: {0}")]
    RpcResponseError(String),

    #[error("Invalid update transaction: {0}")]
    UpdateTransactionError(String),
}
