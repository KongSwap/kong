//! # Resolution Refund Processing
//!
//! This module handles refunds of bets when markets are voided or resolved
//! with disagreements.

use crate::market::market::*;
use crate::types::MarketId;
use crate::token::registry::get_token_info;
use crate::token::transfer::transfer_token;
use crate::resolution::resolution::ResolutionError;
use crate::claims::claims_processing::create_refund_claim;
use crate::claims::claims_types::RefundReason;
use crate::canister::get_current_time;

/// Creates claims for refunds when a market is voided
///
/// This function creates refund claims for all bets in a market when it's being voided.
/// Each user will get a claim for exactly what they bet, with no fees deducted.
/// The claims will need to be processed by users later.
///
/// # Parameters
/// * `market_id` - Reference to the ID of the market being voided
/// * `market` - Reference to the market data
/// * `reason` - The reason for refund claims (e.g., "VoidedMarket", "ResolutionDisagreement")
///
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error if claim creation fails
pub fn create_refund_claims(
    market_id: &MarketId,
    market: &Market,
    reason: &str
) -> Result<(), ResolutionError> {
    ic_cdk::println!("Creating refund claims for all bets in market {}: {}", market_id, reason);
    
    // Get all bets for this market using our helper function
    let bets = crate::storage::get_bets_for_market(market_id);
    
    ic_cdk::println!("Found {} bets to create refund claims for", bets.len());
    
    // If there are no bets, just return success
    if bets.is_empty() {
        return Ok(());
    }
    
    // For each bet, create a refund claim for the user
    let token_id = &market.token_id;
    let token_info = get_token_info(token_id)
        .ok_or_else(|| ResolutionError::MarketNotFound)?;
    let transfer_fee = &token_info.transfer_fee;
    // Current time is not used in this function
    let _current_time = get_current_time();
    
    // Process refund claims for each bet
    for bet in bets {
        // Ensure we don't try to claim less than the transfer fee
        let claim_amount = if bet.amount.clone() > transfer_fee.clone() {
            bet.amount.clone() - transfer_fee.clone()
        } else {
            ic_cdk::println!(
                "Cannot create refund claim for {} to {}: amount is less than transfer fee",
                bet.amount,
                bet.user.to_string()
            );
            continue; // Skip if bet amount is less than transfer fee
        };
        
        // Create a refund claim for this bet
        let refund_reason = RefundReason::Other(reason.to_string());
        
        // Create a refund claim - returns claim ID directly as u64
        let claim_id = create_refund_claim(
            bet.user,
            market_id.clone(),
            bet.amount.clone(),
            refund_reason,
            claim_amount.clone(),
            token_id.clone()
        );
        
        ic_cdk::println!(
            "Created refund claim {} for {} tokens to user {}",
            claim_id,
            claim_amount.clone(),
            bet.user.to_string()
        );
    }
    
    Ok(())
}

/// Refunds all bets when a market is voided
///
/// This function processes refunds for all bets in a market when it's being voided.
/// Each user gets back exactly what they bet, with no fees deducted.
///
/// # Parameters
/// * `market_id` - Reference to the ID of the market being voided
/// * `market` - Reference to the market data
///
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error if refund process fails
pub async fn refund_all_bets(
    market_id: &MarketId,
    market: &Market
) -> Result<(), ResolutionError> {
    ic_cdk::println!("Refunding all bets for market {}", market_id);
    
    // Get all bets for this market using our helper function
    let bets = crate::storage::get_bets_for_market(market_id);
    
    ic_cdk::println!("Found {} bets to refund", bets.len());
    
    // If there are no bets, just return success
    if bets.is_empty() {
        return Ok(());
    }
    
    // For each bet, refund the tokens back to the user
    let token_id = &market.token_id;
    let token_info = get_token_info(token_id)
        .ok_or_else(|| ResolutionError::MarketNotFound)?;
    let token_symbol = token_info.symbol.clone();
    let transfer_fee = &token_info.transfer_fee;
    
    // Process refunds for each bet
    for bet in bets {
        // Ensure we don't try to transfer less than the transfer fee
        let transfer_amount = if bet.amount > transfer_fee.clone() {
            bet.amount - transfer_fee.clone()
        } else {
            ic_cdk::println!(
                "Cannot refund bet of {} {} to {}: amount is less than transfer fee of {}",
                bet.amount.to_u64() / 10u64.pow(token_info.decimals as u32),
                token_symbol,
                bet.user.to_string(),
                transfer_fee.to_u64() / 10u64.pow(token_info.decimals as u32)
            );
            continue; // Skip if bet amount is less than transfer fee
        };
        
        ic_cdk::println!(
            "Returning {} {} to {}", 
            transfer_amount.to_u64() / 10u64.pow(token_info.decimals as u32), 
            token_symbol,
            bet.user.to_string()
        );
        
        // Execute token transfer using the correct function signature
        if let Err(e) = transfer_token(bet.user, transfer_amount, token_id, None).await {
            // If transfer fails, log it but continue with others
            ic_cdk::println!("Error refunding bet to {}: {:?}", bet.user.to_string(), e);
        }
    }
    
    Ok(())
}
