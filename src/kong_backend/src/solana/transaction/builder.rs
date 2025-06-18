//! Solana Transaction Builder
//!
//! This module provides functionality for building Solana transactions.

use anyhow::Result;

use crate::ic::network::ICNetwork;
use crate::solana::error::SolanaError;
use crate::solana::network::{MEMO_PROGRAM_ID, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID};
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
}

impl Default for TransactionBuilder {
    fn default() -> Self {
        Self::new()
    }
}