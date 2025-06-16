//! # Claims Processing Module
//! 
//! This module handles the processing of claim requests, including token transfers
//! and updating claim records. It provides the core functionality for executing
//! the actual claim operations when requested by users.

use candid::Principal;
use std::collections::HashMap;
// Removed unused import: use ic_cdk::api::call;

use crate::types::{MarketId, TokenAmount, OutcomeIndex, TokenIdentifier};
use crate::token::transfer::{transfer_token};
use crate::canister::get_current_time;
use crate::canister::Timestamp;
use crate::claims::claims_types::*;
use crate::claims::claims_storage::*;
use crate::transaction_recovery::record_failed_transaction;

/// Maximum number of automatic retries for a transfer
const MAX_TRANSFER_RETRIES: u8 = 2;

/// Processes a single claim, transferring tokens to the user
pub async fn process_claim(claim_id: u64) -> ClaimResult {
    // Get the claim record
    let claim = match get_claim(claim_id) {
        Some(claim) => claim,
        None => return ClaimResult {
            claim_id,
            success: false,
            block_index: None,
            error: Some("Claim not found".to_string()),
        }
    };
    
    // Check if claim is already processed or being processed
    if !matches!(claim.status, ClaimStatus::Pending) {
        return ClaimResult {
            claim_id,
            success: false,
            block_index: None,
            error: Some(format!("Claim is not in pending state: {:?}", claim.status)),
        };
    }
    
    // Check if the caller is the claim owner
    if claim.user != ic_cdk::caller() {
        return ClaimResult {
            claim_id,
            success: false,
            block_index: None,
            error: Some("Only the claim owner can process this claim".to_string()),
        };
    }
    
    // Set claim status to Claiming to prevent double processing
    // This must happen BEFORE the async inter-canister call
    update_claim_status(claim_id, ClaimStatus::Claiming);
    
    // Process the token transfer
    let transfer_result = transfer_token(
        claim.user,
        claim.claimable_amount.clone(),
        &claim.token_id,
        None, // Use default fee
    ).await;
    
    match transfer_result {
        Ok(block_index) => {
            // Update claim status to processed
            let process_details = ProcessDetails {
                timestamp: Timestamp::from(get_current_time()),
                transaction_id: Some(block_index.clone()),
            };
            
            update_claim_status(claim_id, ClaimStatus::Processed(process_details));
            
            ClaimResult {
                claim_id,
                success: true,
                block_index: Some(block_index),
                error: None,
            }
        },
        Err(err) => {
            // Record the failure
            let now = Timestamp::from(get_current_time());
            let error_message = format!("Transfer failed: {:?}", err);
            
            // Record in transaction recovery system for admin visibility
            record_failed_transaction(
                Some(claim.market_id),
                claim.user,
                claim.claimable_amount.clone(),
                claim.token_id.clone(),
                error_message.clone(),
            );
            
            // Update claim status to failed
            let failure_details = FailureDetails {
                timestamp: now,
                error_message: error_message.clone(),
                retry_count: 1, // First attempt
            };
            
            // If the transfer failed, update status to Failed (not back to Pending)  
            // This helps identify and track previously failed attempts
            update_claim_status(claim_id, ClaimStatus::Failed(failure_details));
            
            ClaimResult {
                claim_id,
                success: false,
                block_index: None,
                error: Some(error_message),
            }
        }
    }
}

/// Processes multiple claims in a batch
pub async fn process_claims(claim_ids: Vec<u64>) -> BatchClaimResult {
    let mut results = Vec::new();
    let mut claimed_amounts: HashMap<TokenIdentifier, TokenAmount> = HashMap::new();
    let mut transaction_ids: HashMap<u64, candid::Nat> = HashMap::new();
    let mut success_count = 0;
    let mut failure_count = 0;
    
    for claim_id in claim_ids {
        let result = process_claim(claim_id).await;
        
        if result.success {
            // If successful, update the claimed amount summary
            success_count += 1;
            
            // Store the transaction ID for successful claims
            if let Some(block_index) = &result.block_index {
                transaction_ids.insert(claim_id, block_index.clone());
            }
            
            if let Some(claim) = get_claim(claim_id) {
                claimed_amounts
                    .entry(claim.token_id)
                    .and_modify(|amount| *amount = amount.clone() + claim.claimable_amount.clone())
                    .or_insert(claim.claimable_amount);
            }
        } else {
            failure_count += 1;
        }
        
        results.push(result);
    }
    
    BatchClaimResult {
        results,
        claimed_amounts,
        success_count,
        failure_count,
        transaction_ids,
    }
}

/// Retries a previously failed claim
pub async fn retry_failed_claim(claim_id: u64) -> ClaimResult {
    // Get the claim record
    let claim = match get_claim(claim_id) {
        Some(claim) => claim,
        None => return ClaimResult {
            claim_id,
            success: false,
            block_index: None,
            error: Some("Claim not found".to_string()),
        }
    };
    
    // Check if claim is in failed state
    if let ClaimStatus::Failed(failure_details) = &claim.status {
        // Check retry count to avoid excessive retries
        if failure_details.retry_count >= MAX_TRANSFER_RETRIES {
            return ClaimResult {
                claim_id,
                success: false,
                block_index: None,
                error: Some(format!("Maximum retry attempts ({}) reached", MAX_TRANSFER_RETRIES)),
            };
        }
        
        // Set claim status to Claiming to prevent double processing during retries
        update_claim_status(claim_id, ClaimStatus::Claiming);
        
        // Retry the token transfer
        let transfer_result = transfer_token(
            claim.user,
            claim.claimable_amount.clone(),
            &claim.token_id,
            None, // Use default fee
        ).await;
        
        match transfer_result {
            Ok(block_index) => {
                // Update claim status to processed
                let process_details = ProcessDetails {
                    timestamp: Timestamp::from(get_current_time()),
                    transaction_id: Some(block_index.clone()),
                };
                
                update_claim_status(claim_id, ClaimStatus::Processed(process_details));
                
                ClaimResult {
                    claim_id,
                    success: true,
                    block_index: Some(block_index),
                    error: None,
                }
            },
            Err(err) => {
                // Update the failed status with incremented retry count
                let now = Timestamp::from(get_current_time());
                let error_message = format!("Retry failed: {:?}", err);
                
                let updated_failure_details = FailureDetails {
                    timestamp: now,
                    error_message: error_message.clone(),
                    retry_count: failure_details.retry_count + 1,
                };
                
                update_claim_status(claim_id, ClaimStatus::Failed(updated_failure_details));
                
                ClaimResult {
                    claim_id,
                    success: false,
                    block_index: None,
                    error: Some(error_message),
                }
            }
        }
    } else {
        // Claim is not in failed state
        ClaimResult {
            claim_id,
            success: false,
            block_index: None,
            error: Some(format!("Claim is not in failed state: {:?}", claim.status)),
        }
    }
}

/// Creates a claim for a refund due to a voided market
pub fn create_refund_claim(
    user: Principal,
    market_id: MarketId, 
    bet_amount: TokenAmount,
    reason: RefundReason,
    refund_amount: TokenAmount,
    token_id: TokenIdentifier,
) -> u64 {
    // Create a new claim
    let claim_type = ClaimType::Refund {
        bet_amount: bet_amount.clone(),
        reason,
    };
    
    create_claim(user, market_id, claim_type, refund_amount, token_id, get_current_time())
}

/// Creates a claim for winnings from a resolved market
pub fn create_winning_claim(
    user: Principal,
    market_id: MarketId,
    bet_amount: TokenAmount,
    outcomes: Vec<OutcomeIndex>,
    winnings_amount: TokenAmount,
    platform_fee: Option<TokenAmount>,
    token_id: TokenIdentifier,
    timestamp: Timestamp,
) -> u64 {
    let claim_type = ClaimType::WinningPayout {
        bet_amount,
        outcomes,
        platform_fee,
    };
    
    create_claim(
        user,
        market_id,
        claim_type,
        winnings_amount,
        token_id,
        timestamp
    )
}

/// Creates a claim for a recovered failed transaction
pub fn create_recovery_claim(
    user: Principal,
    market_id: MarketId,
    bet_amount: TokenAmount,
    amount: TokenAmount,
    token_id: TokenIdentifier,
) -> u64 {
    let claim_type = ClaimType::Refund {
        bet_amount,
        reason: RefundReason::TransactionFailed,
    };
    
    let current_time = get_current_time();
    
    create_claim(
        user,
        market_id,
        claim_type,
        amount,
        token_id,
        current_time
    )
}
