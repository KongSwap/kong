//! Solana Transaction Builder
//!
//! This module provides functionality for building Solana transactions.

use anyhow::Result;
use ic_cdk::api::time;

use crate::solana::error::SolanaError;
use crate::solana::network::{MEMO_PROGRAM_ID, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID};
use crate::solana::rpc::client::SolanaRpcClient;
use crate::solana::sdk::account_meta::AccountMeta;
use crate::solana::sdk::instruction::Instruction;
use crate::stable_memory::with_solana_latest_blockhash;

/// Transaction instructions ready for signing
#[derive(Debug, Clone)]
pub struct TransactionInstructions {
    /// Array of instructions to include in the transaction
    pub instructions: Vec<Instruction>,

    /// Recent blockhash to use for the transaction
    pub blockhash: String,
}

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

impl SolanaRpcClient {
    /// Get the latest blockhash, using the one in stable memory if recent,
    /// otherwise fetching it via HTTPS outcall.
    async fn get_recent_blockhash(&self) -> Result<String> {
        let current_time = time();
        let latest_blockhash = with_solana_latest_blockhash(|cell| cell.get().clone());

        if !latest_blockhash.blockhash.is_empty()
            && current_time.saturating_sub(latest_blockhash.timestamp_nanos)
                < BLOCKHASH_FRESHNESS_THRESHOLD_NANOS
        {
            // Use the blockhash from stable memory if it's recent
            Ok(latest_blockhash.blockhash)
        } else {
            // Fetch a new blockhash via HTTPS outcall if the one in stable memory is old or missing
            let fetched_blockhash = self.get_latest_blockhash().await?.blockhash;
            // Note: The ws_proxy is responsible for updating the stable memory with the new blockhash and timestamp.
            // We don't update it here to avoid potential race conditions if multiple canister calls
            // fetch a new blockhash concurrently.
            Ok(fetched_blockhash)
        }
    }

    /// Build a SOL transfer transaction
    ///
    /// # Arguments
    ///
    /// * `from_address` - The sender's address
    /// * `to_address` - The recipient's address
    /// * `fee_payer` - The fee payer's wallet address
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
        fee_payer: &str,
        lamports: u64,
        memo: Option<String>,
    ) -> Result<TransactionInstructions> {
        // Validate addresses
        if from_address.is_empty() || to_address.is_empty() || fee_payer.is_empty() {
            Err(SolanaError::InvalidPublicKeyFormat(
                "Invalid address for SOL transfer".to_string(),
            ))?
        }

        // Create the transfer instructions
        let transfer_instruction =
            self.create_transfer_sol_instruction(from_address, to_address, lamports)?;
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
    ///
    /// # Arguments
    ///
    /// * `from_address` - The sender's address
    /// * `to_address` - The recipient's address
    /// * `lamports` - The amount of lamports to transfer
    ///
    /// # Returns
    ///
    /// The transfer instruction
    fn create_transfer_sol_instruction(
        &self,
        from_address: &str,
        to_address: &str,
        lamports: u64,
    ) -> Result<Instruction> {
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
    /// * `from_address` - The sender's wallet address
    /// * `from_token_account` - The sender's token account address
    /// * `to_token_account` - The recipient's token account address
    /// * `fee_payer` - The fee payer's wallet address
    /// * `amount` - The amount of tokens to transfer
    /// * `decimals` - The number of decimals the token uses
    /// * `memo` - Optional memo to include in the transaction
    ///
    /// # Returns
    ///
    /// Transaction instructions ready for signing
    pub async fn build_transfer_spl_transaction(
        &self,
        from_address: &str,
        from_token_account: &str,
        to_token_account: &str,
        fee_payer: &str,
        amount: u64,
        memo: Option<String>,
    ) -> Result<TransactionInstructions> {
        // Validate addresses
        if from_address.is_empty()
            || from_token_account.is_empty()
            || to_token_account.is_empty()
            || fee_payer.is_empty()
        {
            Err(SolanaError::InvalidPublicKeyFormat(
                "Invalid address for SPL transfer".to_string(),
            ))?
        }

        // Create the transfer instructions
        let token_transfer_instruction = self.create_transfer_spl_instruction(
            from_address,
            from_token_account,
            to_token_account,
            amount,
        )?;
        let mut instructions = vec![token_transfer_instruction];
        // Add memo instruction if provided
        if let Some(memo_text) = memo {
            let memo_instrument = self.create_memo_instruction(from_address, &memo_text)?;
            instructions.push(memo_instrument);
        }

        let recent_blockhash = self.get_recent_blockhash().await?;
        Ok(TransactionInstructions {
            instructions,
            blockhash: recent_blockhash,
        })
    }

    /// Create a token transfer instruction
    ///
    /// # Arguments
    ///
    /// * `owner_address` - The token owner's wallet address
    /// * `from_token_account` - The sender's token account address
    /// * `to_token_account` - The recipient's token account address
    /// * `amount` - The amount of tokens to transfer
    ///
    /// # Returns
    ///
    /// The token transfer instruction
    fn create_transfer_spl_instruction(
        &self,
        owner_address: &str,
        from_token_account: &str,
        to_token_account: &str,
        amount: u64,
    ) -> Result<Instruction> {
        // Create account metadata
        // For SPL token transfers, we need the following accounts in this exact order:
        // 1. Source token account (writable)
        // 2. Destination token account (writable)
        // 3. Owner of the source token account (signer)
        // Note: The Token Program ID should NOT be included in the accounts list
        // as it's already specified as the program_id for the instruction
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
        // For SPL Token Program, the instruction data format is:
        // - First byte: Instruction type (3 = Transfer)
        // - Next 8 bytes: Amount as u64 in little-endian format
        //
        // Reference: https://github.com/solana-labs/solana-program-library/blob/master/token/program/src/instruction.rs
        // Create a vector with capacity for instruction type (1 byte) + amount (8 bytes)
        let mut data = Vec::with_capacity(9);
        // Add instruction type (3 = Transfer)
        data.push(3);
        // Add amount as 8 bytes in little-endian format
        data.extend_from_slice(&amount.to_le_bytes());

        // Return the instruction with the Token Program ID
        Ok(Instruction {
            program_id: TOKEN_PROGRAM_ID.to_string(),
            accounts,
            data,
        })
    }

    /// Build a SPL token transfer transaction with ATA creation if needed
    ///
    /// Creates a transaction that contains both ATA creation and transfer instructions.
    /// Solana's CreateAssociatedTokenAccount instruction is idempotent - safely executes
    /// even if the ATA already exists, making this approach optimal for all scenarios.
    ///
    /// # Arguments
    ///
    /// * `params` - Parameters for the SPL transfer with ATA creation
    ///
    /// # Returns
    ///
    /// Transaction instructions ready for signing
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
            Err(SolanaError::InvalidPublicKeyFormat(
                "Invalid address for SPL transfer with ATA".to_string(),
            ))?
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

    /// Create a memo instruction
    ///
    /// # Arguments
    ///
    /// * `signer_address` - The address of the signer
    /// * `memo` - The memo text
    ///
    /// # Returns
    ///
    /// The memo instruction
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
