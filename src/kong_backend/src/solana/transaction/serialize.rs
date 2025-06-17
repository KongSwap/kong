//! Transaction serialization for Solana
//!
//! This module handles the serialization of transaction messages into the binary format
//! expected by Solana.

use anyhow::Result;

use crate::solana::error::SolanaError;
use crate::solana::network::SolanaNetwork;
use crate::solana::sdk::compiled_instruction::CompiledInstruction;
use crate::solana::sdk::instruction::Instruction;

/// Message header for Solana transactions
#[derive(Debug, Clone)]
pub struct MessageHeader {
    pub num_required_signatures: u8,
    pub num_readonly_signed_accounts: u8,
    pub num_readonly_unsigned_accounts: u8,
}

/// Transaction message structure
#[derive(Debug, Clone)]
pub struct Message {
    pub header: MessageHeader,
    pub account_keys: Vec<String>, // Pubkey strings
    pub recent_blockhash: String,
    pub instructions: Vec<CompiledInstruction>,
}

impl Message {
    /// Create a new message from instructions
    pub fn new(instructions: Vec<Instruction>, payer: &str) -> Result<Self> {
        // Collect all unique account keys
        let mut account_keys = vec![payer.to_string()]; // Payer is always first
        
        for instruction in &instructions {
            // Add program ID if not already present
            if !account_keys.contains(&instruction.program_id) {
                account_keys.push(instruction.program_id.clone());
            }
            
            // Add accounts
            for account in &instruction.accounts {
                if !account_keys.contains(&account.pubkey) {
                    account_keys.push(account.pubkey.clone());
                }
            }
        }

        // Convert instructions to compiled form
        let compiled_instructions: Vec<CompiledInstruction> = instructions
            .into_iter()
            .map(|inst| {
                let program_id_index = account_keys
                    .iter()
                    .position(|key| key == &inst.program_id)
                    .unwrap() as u8;

                let accounts: Vec<u8> = inst
                    .accounts
                    .iter()
                    .map(|acc| {
                        account_keys
                            .iter()
                            .position(|key| key == &acc.pubkey)
                            .unwrap() as u8
                    })
                    .collect();

                CompiledInstruction {
                    program_id_index,
                    accounts,
                    data: inst.data,
                }
            })
            .collect();

        Ok(Message {
            header: MessageHeader {
                num_required_signatures: 1, // Only payer signs
                num_readonly_signed_accounts: 0,
                num_readonly_unsigned_accounts: 0,
            },
            account_keys,
            recent_blockhash: String::new(), // Will be set later
            instructions: compiled_instructions,
        })
    }

    /// Set the recent blockhash
    pub fn with_blockhash(mut self, blockhash: String) -> Self {
        self.recent_blockhash = blockhash;
        self
    }

    /// Serialize the message for signing
    pub fn serialize(&self) -> Result<Vec<u8>> {
        let mut data = Vec::new();

        // Header (3 bytes)
        data.push(self.header.num_required_signatures);
        data.push(self.header.num_readonly_signed_accounts);
        data.push(self.header.num_readonly_unsigned_accounts);

        // Account keys
        data.push(self.account_keys.len() as u8);
        for key in &self.account_keys {
            let key_bytes = SolanaNetwork::bs58_decode_public_key(key)
                .map_err(|e| SolanaError::InvalidPublicKeyFormat(format!("Invalid pubkey {}: {}", key, e)))?;
            data.extend_from_slice(&key_bytes);
        }

        // Recent blockhash (32 bytes)
        let blockhash_bytes = SolanaNetwork::bs58_decode_public_key(&self.recent_blockhash)
            .map_err(|e| SolanaError::InvalidBlockhash(format!("Invalid blockhash: {}", e)))?;
        data.extend_from_slice(&blockhash_bytes);

        // Instructions
        data.push(self.instructions.len() as u8);
        for instruction in &self.instructions {
            data.push(instruction.program_id_index);
            data.push(instruction.accounts.len() as u8);
            data.extend_from_slice(&instruction.accounts);
            data.push(instruction.data.len() as u8);
            data.extend_from_slice(&instruction.data);
        }

        Ok(data)
    }
}

/// Serialize a message from instructions and blockhash
pub fn serialize_message(instructions: Vec<Instruction>, payer: &str, blockhash: &str) -> Result<Vec<u8>> {
    let message = Message::new(instructions, payer)?
        .with_blockhash(blockhash.to_string());
    message.serialize()
}