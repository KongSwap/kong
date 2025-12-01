//! Transaction serialization for Solana
//!
//! This module handles the serialization of transaction messages into the binary format
//! expected by Solana.

use anyhow::Result;
use std::collections::HashMap;

use crate::solana::sdk::compiled_instruction::CompiledInstruction;
use crate::solana::sdk::instruction::Instruction;
use crate::solana::stable_memory::with_solana_blockhash;
use kong_lib::solana::base58;
use kong_lib::solana::error::SolanaError;

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
    /// Create a new message from instructions (Refactored for safety, performance, and clarity)
    pub fn new(instructions: Vec<Instruction>, payer: &str) -> Result<Self> {
        // 1. Collect all accounts and their properties into a HashMap
        let mut accounts_map: HashMap<String, (bool, bool)> = HashMap::new();
        instructions
            .iter()
            .flat_map(|inst| {
                // Create a single iterator over the program_id and all instruction accounts
                std::iter::once((&inst.program_id, false, false)) // Program IDs are never signers or writable
                    .chain(inst.accounts.iter().map(|acc| (&acc.pubkey, acc.is_signer, acc.is_writable)))
            })
            .for_each(|(key, is_signer, is_writable)| {
                let entry = accounts_map.entry(key.clone()).or_insert((false, false));
                entry.0 |= is_signer;
                entry.1 |= is_writable;
            });

        // Ensure the payer is in the map as a writable signer
        accounts_map.insert(payer.to_string(), (true, true));

        // 2. Sort the accounts with payer first automatically
        let mut sorted_accounts: Vec<_> = accounts_map.into_iter().collect();
        sorted_accounts.sort_by_key(|(key, (is_signer, is_writable))| {
            // Primary sort key: is this the payer? (false comes before true, so payer is first)
            // Secondary sort keys: the standard Solana account order
            (
                key != payer, // Payer gets `false`, everyone else `true`
                match (*is_signer, *is_writable) {
                    (true, true) => 0,
                    (true, false) => 1,
                    (false, true) => 2,
                    (false, false) => 3,
                },
            )
        });

        // 3. Extract final keys and calculate header values in a single pass
        let account_keys: Vec<String> = sorted_accounts.iter().map(|(key, _)| key.clone()).collect();
        let header = sorted_accounts.iter().fold(
            MessageHeader {
                num_required_signatures: 0,
                num_readonly_signed_accounts: 0,
                num_readonly_unsigned_accounts: 0,
            },
            |mut acc, (_, (is_signer, is_writable))| {
                if *is_signer {
                    acc.num_required_signatures += 1;
                    if !*is_writable {
                        acc.num_readonly_signed_accounts += 1;
                    }
                } else if !*is_writable {
                    acc.num_readonly_unsigned_accounts += 1;
                }
                acc
            },
        );

        // 4. Create a reverse lookup map for efficient and safe index resolution
        let key_to_index_map: HashMap<&str, u8> = account_keys.iter().enumerate().map(|(i, key)| (key.as_str(), i as u8)).collect();

        // 5. Compile instructions using the fast lookup map
        let compiled_instructions: Result<Vec<CompiledInstruction>> = instructions
            .into_iter()
            .map(|inst| {
                // Let `?` handle the conversion from SolanaError to anyhow::Error
                let program_id_index = *key_to_index_map
                    .get(inst.program_id.as_str())
                    .ok_or_else(|| SolanaError::TransactionBuildError(format!("Program ID {} not found in key map", inst.program_id)))?;

                let account_indices: Result<Vec<u8>> = inst
                    .accounts
                    .iter()
                    .map(|acc| {
                        key_to_index_map
                            .get(acc.pubkey.as_str())
                            .copied()
                            .ok_or_else(|| SolanaError::TransactionBuildError(format!("Account {} not found in key map", acc.pubkey)))
                    })
                    .collect::<Result<Vec<u8>, _>>() // Specify the collection type to handle the inner Result
                    .map_err(anyhow::Error::from); // Convert the error type for the whole collection at once

                Ok(CompiledInstruction {
                    program_id_index,
                    accounts: account_indices?,
                    data: inst.data,
                })
            })
            .collect();

        Ok(Message {
            header,
            account_keys,
            recent_blockhash: String::new(),
            instructions: compiled_instructions?,
        })
    }

    /// Set the recent blockhash
    pub fn with_blockhash(mut self, blockhash: String) -> Self {
        self.recent_blockhash = blockhash;
        self
    }

    /// Serialize the message for signing
    pub fn serialize(&self) -> Result<Vec<u8>> {
        let mut data = vec![
            self.header.num_required_signatures,
            self.header.num_readonly_signed_accounts,
            self.header.num_readonly_unsigned_accounts,
        ];

        // Account keys
        data.push(self.account_keys.len() as u8);
        for key in &self.account_keys {
            let key_bytes = base58::decode_public_key(key)
                .map_err(|e| SolanaError::InvalidPublicKeyFormat(format!("Invalid pubkey {}: {}", key, e)))?;
            data.extend_from_slice(&key_bytes);
        }

        // Recent blockhash (32 bytes)
        let blockhash_bytes = base58::decode_public_key(&self.recent_blockhash)
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

/// Serialize a message from instructions, getting blockhash internally
pub fn serialize_message(instructions: Vec<Instruction>, payer: &str) -> Result<Vec<u8>> {
    let blockhash = with_solana_blockhash(|cell| cell.get().clone());
    let message = Message::new(instructions, payer)?.with_blockhash(blockhash);
    message.serialize()
}
