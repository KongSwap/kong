//! Solana Transaction Builder
//!
//! This module provides functionality for building Solana transactions.

use anyhow::Result;
use curve25519_dalek::edwards::CompressedEdwardsY;
use sha2::{Digest, Sha256};

use crate::ic::network::ICNetwork;
use crate::solana::error::SolanaError;
use crate::solana::network::{ASSOCIATED_TOKEN_PROGRAM_ID, MEMO_PROGRAM_ID, SYSVAR_RENT_PROGRAM_ID, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID};
use crate::solana::sdk::account_meta::AccountMeta;
use crate::solana::sdk::instruction::Instruction;
use crate::solana::utils::validation;
use crate::stable_memory::with_solana_latest_blockhash;

/// Transaction instructions ready for signing
#[derive(Debug, Clone)]
pub struct TransactionInstructions {
    /// Array of instructions to include in the transaction
    pub instructions: Vec<Instruction>,

    /// Recent blockhash to use for the transaction
    pub blockhash: String,
}

/// Transaction builder for creating Solana transactions
pub struct TransactionBuilder;

// Define a constant for the blockhash freshness threshold (45 seconds in nanoseconds)
const BLOCKHASH_FRESHNESS_THRESHOLD_NANOS: u64 = 45 * 1_000_000_000;

/// Parameters for building a SPL token transfer transaction with ATA creation
#[derive(Debug, Clone)]
pub struct SplTransferWithAtaParams<'a> {
    /// The sender's wallet address
    pub from_address: &'a str,
    /// The sender's token account address
    pub from_token_account: &'a str,
    /// The recipient's wallet address
    pub to_wallet_address: &'a str,
    /// The recipient's token account address
    pub to_token_account: &'a str,
    /// The token mint address
    pub mint_address: &'a str,
    /// The fee payer's wallet address
    pub fee_payer: &'a str,
    /// The amount of tokens to transfer
    pub amount: u64,
    /// Optional memo to include in the transaction
    pub memo: Option<String>,
}

impl TransactionBuilder {
    /// Create a new transaction builder
    pub fn new() -> Self {
        TransactionBuilder
    }

    /// Get the latest blockhash, using the one in stable memory if recent
    async fn get_recent_blockhash(&self) -> Result<String> {
        let latest_blockhash = with_solana_latest_blockhash(|cell| cell.get().clone());
        if latest_blockhash.blockhash.is_empty() {
            return Err(SolanaError::BlockhashError("No blockhash found in stable memory".to_string()))?;
        }

        let current_time = ICNetwork::get_time();
        if current_time.saturating_sub(latest_blockhash.timestamp_nanos) > BLOCKHASH_FRESHNESS_THRESHOLD_NANOS {
            return Err(SolanaError::BlockhashError("Recent blockhash is too old".to_string()))?;
        }

        Ok(latest_blockhash.blockhash)
    }

    /// Build a SOL transfer transaction
    ///
    /// # Arguments
    ///
    /// * `from_address` - The sender's address
    /// * `to_address` - The recipient's address
    /// * `lamports` - The amount of lamports to transfer
    /// * `memo` - Optional memo to include in the transaction
    ///
    /// # Returns
    ///
    /// Transaction instructions ready for signing
    pub async fn build_transfer_sol_transaction(
        &self,
        from_address: &str,
        to_address: &str,
        lamports: u64,
        memo: Option<String>,
    ) -> Result<TransactionInstructions> {
        // Validate addresses
        validation::validate_addresses(&[from_address, to_address])?;

        // Create the transfer instructions
        let transfer_instruction = self.create_transfer_sol_instruction(from_address, to_address, lamports)?;
        let mut instructions = vec![transfer_instruction];
        
        // Add memo instruction if provided
        if let Some(memo_text) = memo {
            let memo_instruction = self.create_memo_instruction(from_address, &memo_text)?;
            instructions.push(memo_instruction);
        }

        let recent_blockhash = self.get_recent_blockhash().await?;
        Ok(TransactionInstructions {
            instructions,
            blockhash: recent_blockhash,
        })
    }

    /// Create a transfer instruction
    fn create_transfer_sol_instruction(&self, from_address: &str, to_address: &str, lamports: u64) -> Result<Instruction> {
        // Create account metadata
        let accounts = vec![
            AccountMeta {
                pubkey: from_address.to_string(),
                is_signer: true,
                is_writable: true,
            },
            AccountMeta {
                pubkey: to_address.to_string(),
                is_signer: false,
                is_writable: true,
            },
        ];

        // Create instruction data for system program transfer
        // 0x02 = Transfer instruction
        let mut data = vec![2, 0, 0, 0]; // Transfer command (little-endian u32)
        data.extend_from_slice(&lamports.to_le_bytes()); // Amount in lamports

        // Return the instruction
        Ok(Instruction {
            program_id: SYSTEM_PROGRAM_ID.to_string(),
            accounts,
            data,
        })
    }

    /// Build a SPL token transfer transaction
    ///
    /// # Arguments
    ///
    /// * `owner_address` - The token owner's wallet address
    /// * `from_token_account` - The sender's token account address
    /// * `to_token_account` - The recipient's token account address
    /// * `amount` - The amount of tokens to transfer
    /// * `memo` - Optional memo to include in the transaction
    ///
    /// # Returns
    ///
    /// Transaction instructions ready for signing
    pub async fn build_transfer_spl_transaction(
        &self,
        owner_address: &str,
        from_token_account: &str,
        to_token_account: &str,
        amount: u64,
        memo: Option<String>,
    ) -> Result<TransactionInstructions> {
        // Validate addresses
        validation::validate_addresses(&[owner_address, from_token_account, to_token_account])?;

        // Create the transfer instructions
        let token_transfer_instruction =
            self.create_transfer_spl_instruction(owner_address, from_token_account, to_token_account, amount)?;
        let mut instructions = vec![token_transfer_instruction];
        
        // Add memo instruction if provided
        if let Some(memo_text) = memo {
            let memo_instrument = self.create_memo_instruction(owner_address, &memo_text)?;
            instructions.push(memo_instrument);
        }

        let recent_blockhash = self.get_recent_blockhash().await?;
        Ok(TransactionInstructions {
            instructions,
            blockhash: recent_blockhash,
        })
    }

    /// Create a token transfer instruction
    fn create_transfer_spl_instruction(
        &self,
        owner_address: &str,
        from_token_account: &str,
        to_token_account: &str,
        amount: u64,
    ) -> Result<Instruction> {
        // Create account metadata
        let accounts = vec![
            // Source token account
            AccountMeta {
                pubkey: from_token_account.to_string(),
                is_signer: false,
                is_writable: true,
            },
            // Destination token account
            AccountMeta {
                pubkey: to_token_account.to_string(),
                is_signer: false,
                is_writable: true,
            },
            // Owner of the source token account
            AccountMeta {
                pubkey: owner_address.to_string(),
                is_signer: true,
                is_writable: false,
            },
        ];

        // Create instruction data for token transfer
        let mut data = Vec::with_capacity(9);
        data.push(3); // Transfer instruction = 3
        data.extend_from_slice(&amount.to_le_bytes());

        // Return the instruction with the Token Program ID
        Ok(Instruction {
            program_id: TOKEN_PROGRAM_ID.to_string(),
            accounts,
            data,
        })
    }

    /// Create a memo instruction
    fn create_memo_instruction(&self, signer_address: &str, memo: &str) -> Result<Instruction> {
        // Create account metadata
        let accounts = vec![AccountMeta {
            pubkey: signer_address.to_string(),
            is_signer: true,
            is_writable: false,
        }];

        // Return the instruction with memo text as data
        Ok(Instruction {
            program_id: MEMO_PROGRAM_ID.to_string(),
            accounts,
            data: memo.as_bytes().to_vec(),
        })
    }

    /// Derive the associated token account address for a wallet and mint
    pub fn derive_associated_token_account(
        &self,
        wallet_address: &str,
        mint_address: &str,
    ) -> Result<String> {
        if wallet_address.is_empty() || mint_address.is_empty() {
            return Err(SolanaError::InvalidPublicKeyFormat(
                "Wallet address or mint address is empty".to_string(),
            ).into());
        }

        // Decode wallet and mint to 32-byte arrays
        let wallet_address_bytes = crate::solana::network::SolanaNetwork::bs58_decode_public_key(wallet_address)?;
        let mint_address_bytes = crate::solana::network::SolanaNetwork::bs58_decode_public_key(mint_address)?;
        let token_program_bytes = crate::solana::network::SolanaNetwork::bs58_decode_public_key(TOKEN_PROGRAM_ID)?;
        let ata_program_bytes = crate::solana::network::SolanaNetwork::bs58_decode_public_key(ASSOCIATED_TOKEN_PROGRAM_ID)?;
        
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
        ).into())
    }

    /// Proper "is_on_curve" check using curve25519-dalek.
    /// A point is on the curve if it can be decompressed to a valid Edwards point.
    fn is_on_curve(candidate: &[u8; 32]) -> Result<bool> {
        // Create a CompressedEdwardsY from the 32-byte array
        let compressed = CompressedEdwardsY::from_slice(candidate.as_ref())
            .map_err(|_| SolanaError::InvalidPublicKeyFormat("Invalid token account format.".to_string()))?;
        // Check if it can be decompressed to a valid Edwards point
        Ok(compressed.decompress().is_some())
    }

    /// Create instruction to create an associated token account (idempotent version)
    pub fn create_associated_token_account_instruction(
        &self,
        fee_payer: &str,
        wallet_address: &str,
        mint_address: &str,
    ) -> Result<Instruction> {
        // Derive the associated token account address
        let associated_token_account =
            self.derive_associated_token_account(wallet_address, mint_address)?;

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

    /// Build a SPL token transfer transaction with ATA creation if needed
    pub async fn build_transfer_spl_with_ata_transaction(
        &self,
        params: SplTransferWithAtaParams<'_>,
    ) -> Result<TransactionInstructions> {
        // Validate addresses
        if params.from_address.is_empty()
            || params.from_token_account.is_empty()
            || params.to_wallet_address.is_empty()
            || params.to_token_account.is_empty()
            || params.mint_address.is_empty()
            || params.fee_payer.is_empty()
        {
            return Err(SolanaError::InvalidPublicKeyFormat(
                "Invalid address for SPL transfer with ATA".to_string(),
            ).into());
        }

        let mut instructions = Vec::new();

        // 1. Create ATA instruction (idempotent - no error if ATA exists)
        let create_ata_instruction = self.create_associated_token_account_instruction(
            params.fee_payer,
            params.to_wallet_address,
            params.mint_address,
        )?;
        instructions.push(create_ata_instruction);

        // 2. Create transfer instruction
        let transfer_instruction = self.create_transfer_spl_instruction(
            params.from_address,
            params.from_token_account,
            params.to_token_account,
            params.amount,
        )?;
        instructions.push(transfer_instruction);

        // 3. Add memo instruction if provided
        if let Some(memo_text) = params.memo {
            let memo_instruction = self.create_memo_instruction(params.from_address, &memo_text)?;
            instructions.push(memo_instruction);
        }

        let recent_blockhash = self.get_recent_blockhash().await?;
        Ok(TransactionInstructions {
            instructions,
            blockhash: recent_blockhash,
        })
    }
}

impl Default for TransactionBuilder {
    fn default() -> Self {
        Self::new()
    }
}