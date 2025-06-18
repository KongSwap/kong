use anyhow::Result;
use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;
use std::fmt;

use crate::ic::management_canister::ManagementCanister;

use super::error::SolanaError;
use super::utils::base58;

// Known program IDs on Solana network
pub const SYSTEM_PROGRAM_ID: &str = "11111111111111111111111111111111";
pub const MEMO_PROGRAM_ID: &str = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
pub const TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
pub const ASSOCIATED_TOKEN_PROGRAM_ID: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
pub const SYSVAR_RENT_PROGRAM_ID: &str = "SysvarRent111111111111111111111111111111111";

#[derive(CandidType, Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SolanaNetwork {
    Mainnet,
    Devnet,
}

impl fmt::Display for SolanaNetwork {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SolanaNetwork::Mainnet => write!(f, "Mainnet"),
            SolanaNetwork::Devnet => write!(f, "Devnet"),
        }
    }
}

impl SolanaNetwork {
    pub fn bs58_encode_public_key(public_key: &[u8]) -> String {
        base58::encode(public_key)
    }

    pub fn bs58_decode_public_key(public_key: &str) -> Result<[u8; 32]> {
        base58::decode_public_key(public_key)
            .map_err(|e| e.into())
    }

    pub async fn get_public_key(canister: &Principal) -> Result<String> {
        let derivation_path = ManagementCanister::get_canister_derivation_path(canister);
        let public_key_bytes = ManagementCanister::get_schnorr_public_key(canister, derivation_path)
            .await
            .map_err(|e| SolanaError::PublicKeyRetrievalError(e.to_string()))?;
        let validated_public_key = SolanaNetwork::validate_public_key(&public_key_bytes)?;
        Ok(SolanaNetwork::bs58_encode_public_key(&validated_public_key))
    }

    pub fn validate_public_key(public_key: &[u8]) -> Result<Vec<u8>> {
        // Ed25519 public keys are 32 bytes long
        if public_key.len() != 32 {
            Err(SolanaError::InvalidPublicKeyFormat("Public key must be 32 bytes long.".to_string()))?;
        }

        Ok(public_key.to_vec())
    }

    pub fn validate_tx_signature(tx_signature: &[u8]) -> Result<Vec<u8>> {
        // Ed25519 signatures are 64 bytes long
        if tx_signature.len() != 64 {
            Err(SolanaError::InvalidSignature(
                "Transaction signature must be 64 bytes long.".to_string(),
            ))?;
        }

        Ok(tx_signature.to_vec())
    }
}
