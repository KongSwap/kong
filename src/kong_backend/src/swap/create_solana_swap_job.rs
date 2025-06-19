//! Module for creating Solana swap jobs for outgoing transfers
//!
//! This handles the creation of swap jobs that will be processed by kong_rpc
//! to execute Solana transactions.

use candid::Nat;
use num_traits::ToPrimitive;
use serde_json;

use crate::ic::address::Address;
use crate::ic::network::ICNetwork;
use crate::stable_memory::{get_cached_solana_address, get_next_solana_swap_job_id, with_swap_job_queue_mut, with_solana_latest_blockhash};
use crate::stable_token::{stable_token::StableToken, token::Token};
use crate::solana::transaction::builder::TransactionBuilder;
use crate::solana::transaction::sign::sign_transaction;

use super::swap_job::{SwapJob, SwapJobParams, SwapJobStatus};

/// Creates a Solana swap job for processing an outgoing transfer
pub async fn create_solana_swap_job(
    request_id: u64,
    user_id: u32,
    receive_token: &StableToken,
    receive_amount: &Nat,
    to_address: &Address,
) -> Result<u64, String> {
    // Validate that this is a Solana token
    if let StableToken::Solana(sol_token) = receive_token {
        // Extract destination Solana address
        let destination_address = match to_address {
            Address::AccountId(account_id) => {
                // For backward compatibility, some users might still use AccountId
                // Convert the 32-byte AccountId to a base58 Solana address
                bs58::encode(account_id).into_string()
            }
            Address::PrincipalId(_) => {
                return Err("Cannot send Solana tokens to IC Principal. Please provide a Solana address.".to_string());
            }
        };

        // Get Kong's Solana address
        let kong_address = get_cached_solana_address();
        if kong_address.is_empty() {
            return Err("Kong Solana address not initialized".to_string());
        }

        // Get the latest blockhash
        let _blockhash = with_solana_latest_blockhash(|cell| {
            let latest = cell.get();
            if latest.blockhash.is_empty() {
                return Err("No blockhash available".to_string());
            }
            Ok(latest.blockhash.clone())
        })?;

        // Get the job ID
        let job_id = get_next_solana_swap_job_id();

        // Convert amount to u64
        let amount_u64 = receive_amount.0.to_u64()
            .ok_or("Amount too large for Solana transfer")?;

        // Build transaction instructions based on token type
        let builder = TransactionBuilder::new();
        let instructions = if sol_token.mint_address == "11111111111111111111111111111111" {
            // Native SOL transfer
            builder.build_transfer_sol_transaction(
                &kong_address,
                &destination_address,
                amount_u64,
                Some(format!("Kong swap job #{}", job_id)),
            ).await
            .map_err(|e| format!("Failed to build SOL transfer: {}", e))?
        } else {
            // SPL token transfer
            // For SPL tokens, we need to build a transfer with ATA creation
            // This is a simplified version - kong_rpc will handle the actual ATA computation
            return Err("SPL token transfers not yet fully implemented in kong_backend".to_string());
        };

        // Sign the transaction
        let signed_tx = sign_transaction(instructions, &kong_address)
            .await
            .map_err(|e| format!("Failed to sign transaction: {}", e))?;

        // Extract signature for tracking first (before moving signed_tx)
        let tx_sig = if !signed_tx.signatures.is_empty() {
            bs58::encode(&signed_tx.signatures[0]).into_string()
        } else {
            return Err("No signature in signed transaction".to_string());
        };

        // Encode the signed transaction using serde_cbor (available in Cargo.toml)
        let encoded_tx = serde_cbor::to_vec(&(signed_tx.message, signed_tx.signatures))
            .map_err(|e| format!("Failed to encode transaction: {}", e))?;
        let encoded_tx_base64 = bs58::encode(&encoded_tx).into_string();

        // Create the swap job
        let current_time = ICNetwork::get_time();
        
        // Create a simplified args structure for the job
        let job_args = serde_json::json!({
            "request_id": request_id,
            "user_id": user_id,
            "receive_token": receive_token.symbol(),
            "receive_amount": amount_u64,
            "to_address": destination_address,
            "mint_address": sol_token.mint_address,
            "program_id": sol_token.program_id,
        });

        let swap_job_params = SwapJobParams {
            id: job_id,
            caller: ICNetwork::caller(),
            original_args_json: job_args.to_string(),
            status: SwapJobStatus::Pending,
            created_at: current_time,
            updated_at: current_time,
            encoded_signed_solana_tx: encoded_tx_base64,
            solana_tx_signature_of_payout: None,
            error_message: None,
            attempts: 0,
            tx_sig,
        };

        let swap_job = SwapJob::new(swap_job_params);

        // Store the job in the queue
        with_swap_job_queue_mut(|queue| {
            queue.insert(job_id, swap_job);
        });

        Ok(job_id)
    } else {
        Err("Not a Solana token".to_string())
    }
}