//! Solana Token Account Management
//!
//! This module provides functionality for managing SPL token accounts.

use anyhow::Result;
use candid::Principal;
use curve25519_dalek::edwards::CompressedEdwardsY;
use sha2::{Digest, Sha256};

use crate::solana::error::SolanaError;
use crate::solana::network::SolanaNetwork;
use crate::solana::network::{ASSOCIATED_TOKEN_PROGRAM_ID, SYSTEM_PROGRAM_ID, SYSVAR_RENT_PROGRAM_ID, TOKEN_PROGRAM_ID};
use crate::solana::rpc::client::SolanaRpcClient;
use crate::solana::sdk::account_meta::AccountMeta;
use crate::solana::sdk::instruction::Instruction;

use super::builder::TransactionInstructions;

impl SolanaRpcClient {
    /// Derive the associated token account address for a wallet and mint (low-level).
    ///
    /// This matches the official Solana approach:
    ///  - Seeds: [wallet_pubkey, SPL Token Program ID, mint_pubkey]
    ///  - Program ID: Associated Token Program
    ///  - find_program_address-like approach with `ProgramDerivedAddress` prefix
    ///  - We want an "off-curve" address
    pub fn derive_associated_token_account(&self, wallet_address: &str, mint_address: &str) -> Result<String> {
        if wallet_address.is_empty() || mint_address.is_empty() {
            Err(SolanaError::InvalidPublicKeyFormat(
                "Wallet address or mint address is empty".to_string(),
            ))?;
        }

        // Decode wallet and mint to 32-byte arrays
        let wallet_address_bytes = SolanaNetwork::bs58_decode_public_key(wallet_address)?;
        let mint_address_bytes = SolanaNetwork::bs58_decode_public_key(mint_address)?;
        let token_program_bytes = SolanaNetwork::bs58_decode_public_key(TOKEN_PROGRAM_ID)?;
        let ata_program_bytes = SolanaNetwork::bs58_decode_public_key(ASSOCIATED_TOKEN_PROGRAM_ID)?;
        // Seeds: [wallet, token_program, mint]. Exact order specified in the Solana docs
        let seeds: [&[u8]; 3] = [
            wallet_address_bytes.as_ref(),
            token_program_bytes.as_ref(),
            mint_address_bytes.as_ref(),
        ];

        // Marker for PDAs
        const PDA_MARKER: &[u8] = b"ProgramDerivedAddress";
        let mut derived_address = [0u8; 32];
        let mut found = false;
        // Try each bump seed starting from 255 and going down to 0
        for bump_seed in (0u8..=255).rev() {
            // Create a new seed array that includes the bump seed
            let mut seeds_with_bump = Vec::with_capacity(seeds.len() + 1);
            for seed in &seeds {
                seeds_with_bump.push(*seed);
            }
            // Create a longer-lived value for the bump seed
            let bump_seed_array = [bump_seed];
            seeds_with_bump.push(&bump_seed_array);

            // Now implement create_program_address logic
            let mut hasher = Sha256::new();
            // Hash each seed
            for seed in &seeds_with_bump {
                hasher.update(seed);
            }
            // Hash the program ID and PDA marker
            hasher.update(ata_program_bytes);
            hasher.update(PDA_MARKER);
            // Get the resulting hash
            let hash_result = hasher.finalize();
            let mut candidate = [0u8; 32];
            candidate.copy_from_slice(&hash_result[..32]);

            // Check if the point is NOT on the curve (valid PDA)
            if !Self::is_on_curve(&candidate)? {
                derived_address = candidate;
                found = true;
                break;
            }
        }

        if found {
            // Convert final 32 bytes -> base58
            return Ok(bs58::encode(derived_address).into_string());
        }

        Err(SolanaError::InvalidPublicKeyFormat(
            "Could not find a valid off-curve ATA PDA (bump 0..=255 exhausted)".to_string(),
        ))?
    }

    /// Create an associated token account (idempotent)
    ///
    /// # Arguments
    ///
    /// * `canister` - The signing canister that will submit the transaction
    /// * `wallet_address` - The wallet address that will own the token account
    /// * `mint_address` - The token mint address
    /// * `fee_payer` - The address that will pay the transaction fee
    ///
    /// # Returns
    ///
    /// The associated token account address (derived deterministically)
    pub async fn create_associated_token_account(
        &self,
        canister: &Principal,
        wallet_address: &str,
        mint_address: &str,
        fee_payer: &str,
    ) -> Result<String> {
        // Derive the associated token account address deterministically
        let associated_token_account = self.derive_associated_token_account(wallet_address, mint_address)?;

        // Build and submit the idempotent create instruction
        let instructions = self.build_create_ata_transaction(&wallet_address, mint_address, fee_payer).await?;

        // Submit the transaction (will succeed even if account already exists)
        self.submit_transaction(canister, instructions, fee_payer).await?;

        // Return the derived address
        Ok(associated_token_account)
    }

    /// Proper "is_on_curve" check using curve25519-dalek.
    /// A point is on the curve if it can be decompressed to a valid Edwards point.
    fn is_on_curve(candidate: &[u8; 32]) -> Result<bool, SolanaError> {
        // Create a CompressedEdwardsY from the 32-byte array
        let compressed = CompressedEdwardsY::from_slice(candidate.as_ref())
            .map_err(|_| SolanaError::TokenAccountNotFound("Invalid token account format.".to_string()))?;
        // Check if it can be decompressed to a valid Edwards point
        Ok(compressed.decompress().is_some())
    }

    /// Build transaction to create an associated token account
    ///
    /// # Arguments
    ///
    /// * `wallet_address` - The wallet address that will own the token account
    /// * `mint_address` - The token mint address
    /// * `fee_payer` - The address that will pay the transaction fee
    /// * `builder` - The transaction builder
    ///
    /// # Returns
    ///
    /// The transaction instructions
    async fn build_create_ata_transaction(
        &self,
        wallet_address: &str,
        mint_address: &str,
        fee_payer: &str,
    ) -> Result<TransactionInstructions> {
        // Create the instruction
        let create_ata_instruction = self.create_associated_token_account_instruction(fee_payer, wallet_address, mint_address)?;
        let instructions = vec![create_ata_instruction];

        let recent_blockhash = self.get_latest_blockhash().await?;
        Ok(TransactionInstructions {
            instructions,
            blockhash: recent_blockhash.blockhash,
        })
    }

    /// Create instruction to create an associated token account (idempotent version)
    ///
    /// # Arguments
    ///
    /// * `fee_payer` - The address that will pay the transaction fee
    /// * `wallet_address` - The wallet address that will own the token account
    /// * `mint_address` - The token mint address
    ///
    /// # Returns
    ///
    /// The instruction
    pub fn create_associated_token_account_instruction(
        &self,
        fee_payer: &str,
        wallet_address: &str,
        mint_address: &str,
    ) -> Result<Instruction> {
        // Derive the associated token account address
        let associated_token_account = self.derive_associated_token_account(wallet_address, mint_address)?;

        // Create the accounts for the instruction
        let accounts = vec![
            // Fee payer
            AccountMeta {
                pubkey: fee_payer.to_string(),
                is_signer: true,
                is_writable: true,
            },
            // Associated token account to create
            AccountMeta {
                pubkey: associated_token_account,
                is_signer: false,
                is_writable: true,
            },
            // Wallet address (owner)
            AccountMeta {
                pubkey: wallet_address.to_string(),
                is_signer: false,
                is_writable: false,
            },
            // Mint address
            AccountMeta {
                pubkey: mint_address.to_string(),
                is_signer: false,
                is_writable: false,
            },
            // System program
            AccountMeta {
                pubkey: SYSTEM_PROGRAM_ID.to_string(),
                is_signer: false,
                is_writable: false,
            },
            // Token program
            AccountMeta {
                pubkey: TOKEN_PROGRAM_ID.to_string(),
                is_signer: false,
                is_writable: false,
            },
            // Sysvar Rent program
            AccountMeta {
                pubkey: SYSVAR_RENT_PROGRAM_ID.to_string(),
                is_signer: false,
                is_writable: false,
            },
        ];

        // Create the instruction
        let instruction = Instruction {
            program_id: ASSOCIATED_TOKEN_PROGRAM_ID.to_string(),
            accounts,
            data: vec![1], // Idempotent instruction discriminator
        };

        Ok(instruction)
    }
}
