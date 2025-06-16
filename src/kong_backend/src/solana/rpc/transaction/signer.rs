//! Solana Transaction Signer
//!
//! This module provides functionality for signing Solana transactions.

use anyhow::Result;
use candid::Principal;

use crate::ic::management_canister::ManagementCanister;
use crate::solana::error::SolanaError;
use crate::solana::network::SolanaNetwork;
use crate::solana::rpc::client::SolanaRpcClient;
use crate::solana::rpc::transaction::builder::TransactionInstructions;
use crate::solana::sdk::compiled_instruction::CompiledInstruction;

/// Signed transaction data
#[derive(Debug, Clone)]
pub struct SignedTransaction {
    /// The serialized transaction data
    pub transaction_data: Vec<u8>,

    /// The transaction signature
    pub signature: Vec<u8>,
}

/// Transaction message header
#[derive(Debug, Clone)]
struct MessageHeader {
    /// Number of required signatures
    pub num_required_signatures: u8,

    /// Number of read-only signed accounts
    pub num_readonly_signed_accounts: u8,

    /// Number of read-only unsigned accounts
    pub num_readonly_unsigned_accounts: u8,
}

/// Transaction message
#[derive(Debug, Clone)]
struct Message {
    /// The message header
    pub header: MessageHeader,

    /// The list of all account public keys used in this transaction
    pub account_keys: Vec<String>,

    /// The recent blockhash
    pub recent_blockhash: String,

    /// The instructions
    pub instructions: Vec<CompiledInstruction>,
}

impl SolanaRpcClient {
    /// Sign a transaction
    ///
    /// # Arguments
    ///
    /// * `canister` - The signing canister principal ID
    /// * `instructions` - The transaction instructions to sign
    /// * `fee_payer` - The address that will pay the transaction fee
    ///
    /// # Returns
    ///
    /// The signed transaction
    pub async fn sign_transaction(
        &self,
        canister: &Principal,
        instructions: TransactionInstructions,
        fee_payer: &str,
    ) -> Result<SignedTransaction> {
        // Create the message (will contain all the transaction details)
        let message = self.create_message(&instructions, fee_payer)?;
        // Serialize the message
        let message_data = self.serialize_message(&message)?;
        // Sign the message data using IC ECDSA signing
        let signature = ManagementCanister::sign_with_schnorr(canister, &message_data).await?;

        // Return the signed transaction
        Ok(SignedTransaction {
            transaction_data: message_data,
            signature,
        })
    }

    /// Create a transaction message
    ///
    /// # Arguments
    ///
    /// * `instructions` - The transaction instructions
    /// * `public_key` - The public key of the signer
    ///
    /// # Returns
    ///
    /// The transaction message
    fn create_message(&self, instructions: &TransactionInstructions, fee_payer: &str) -> Result<Message> {
        // Collect all account keys used in the transaction
        let mut account_keys = vec![fee_payer.to_string()]; // Fee payer is always first
        let mut account_key_indices = std::collections::HashMap::new();

        // Add fee payer to the map
        account_key_indices.insert(fee_payer.to_string(), 0);

        // Process each instruction
        for instruction in instructions.instructions.iter() {
            // Add program ID if not already in the list
            if !account_key_indices.contains_key(&instruction.program_id) {
                let index = account_keys.len();
                account_keys.push(instruction.program_id.clone());
                account_key_indices.insert(instruction.program_id.clone(), index);
            }

            // Add each account if not already in the list
            for account in instruction.accounts.iter() {
                if !account_key_indices.contains_key(&account.pubkey) {
                    let index = account_keys.len();
                    account_keys.push(account.pubkey.clone());
                    account_key_indices.insert(account.pubkey.clone(), index);
                }
            }
        }

        // Compile instructions using the account indices
        let mut compiled_instructions = Vec::new();
        for instruction in instructions.instructions.iter() {
            let program_id_index = *account_key_indices.get(&instruction.program_id).unwrap() as u8;

            let mut accounts = Vec::new();
            for account in instruction.accounts.iter() {
                let account_index = *account_key_indices.get(&account.pubkey).unwrap() as u8;
                accounts.push(account_index);
            }

            compiled_instructions.push(CompiledInstruction {
                program_id_index,
                accounts,
                data: instruction.data.clone(),
            });
        }

        // Count readonly and writable accounts
        let num_readonly_signed_accounts = 0;
        let num_readonly_unsigned_accounts = 0;

        // Only count the fee payer as a writable, signed account
        // All other accounts need to be analyzed based on the instructions

        // Create and return the message
        Ok(Message {
            header: MessageHeader {
                num_required_signatures: 1, // Only the fee payer needs to sign
                num_readonly_signed_accounts,
                num_readonly_unsigned_accounts,
            },
            account_keys,
            recent_blockhash: instructions.blockhash.clone(),
            instructions: compiled_instructions,
        })
    }

    /// Serialize the message
    ///
    /// # Arguments
    ///
    /// * `message` - The message to serialize
    ///
    /// # Returns
    ///
    /// The serialized message
    fn serialize_message(&self, message: &Message) -> Result<Vec<u8>> {
        let mut buffer = Vec::new();

        // Serialize header
        buffer.push(message.header.num_required_signatures);
        buffer.push(message.header.num_readonly_signed_accounts);
        buffer.push(message.header.num_readonly_unsigned_accounts);

        // Serialize account keys
        // First, ensure we have the correct number of account keys
        if message.account_keys.len() > 255 {
            Err(SolanaError::EncodingError("Too many account keys in message".to_string()))?
        }

        // Add the number of account keys
        buffer.push(message.account_keys.len() as u8);

        // Add each account key (32 bytes each)
        for key in &message.account_keys {
            let decoded = SolanaNetwork::bs58_decode_public_key(key)
                .map_err(|e| SolanaError::EncodingError(format!("Failed to decode account key: {}", e)))?;
            buffer.extend_from_slice(&decoded);
        }

        // Serialize recent blockhash (32 bytes)
        let blockhash_decoded = SolanaNetwork::bs58_decode_public_key(&message.recent_blockhash)
            .map_err(|e| SolanaError::EncodingError(format!("Failed to decode blockhash: {}", e)))?;
        buffer.extend_from_slice(&blockhash_decoded);

        // Serialize instructions
        // First, ensure we have the correct number of instructions
        if message.instructions.len() > 255 {
            Err(SolanaError::EncodingError("Too many instructions in message".to_string()))?
        }

        // Add the number of instructions
        buffer.push(message.instructions.len() as u8);

        // Add each instruction
        for instruction in &message.instructions {
            // Add program ID index
            buffer.push(instruction.program_id_index);

            // Add accounts
            // First, ensure we have the correct number of accounts
            if instruction.accounts.len() > 255 {
                Err(SolanaError::EncodingError("Too many accounts in instruction".to_string()))?
            }

            // Add the number of accounts
            buffer.push(instruction.accounts.len() as u8);

            // Add each account index
            buffer.extend_from_slice(&instruction.accounts);

            // Add data
            // First, ensure we have the correct amount of data
            if instruction.data.len() > 255 {
                Err(SolanaError::EncodingError("Too much data in instruction".to_string()))?
            }

            // Add the data length
            buffer.push(instruction.data.len() as u8);

            // Add the data
            buffer.extend_from_slice(&instruction.data);
        }

        Ok(buffer)
    }
}
