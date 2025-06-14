//! # Resolution Refund Processing
//!
//! This module handles refunds of bets when markets are voided or resolved
//! with disagreements.
//!
//! Special handling is implemented for resolution disagreements, where the creator's
//! deposit is burned (sent to minter) rather than refunded.

use crate::market::market::*;
use crate::types::{MarketId, TokenAmount};
use crate::token::registry::get_token_info;
use crate::token::transfer::transfer_token;
use crate::resolution::resolution::ResolutionError;
use crate::claims::claims_processing::create_refund_claim;
use crate::claims::claims_types::RefundReason;
use crate::canister::get_current_time;
use crate::resolution::transfer_kong::burn_tokens;
use crate::bet::bet::Bet;

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

/// Creates refund claims for a market during resolution disagreement
/// 
/// This function works like create_refund_claims, but it specifically handles
/// the case where there's a disagreement between the market creator and an admin.
/// In this case, the creator's activation deposit is burned (sent to minter), while
/// all other users get refunds.
///
/// # Parameters
/// * `market_id` - Reference to the ID of the market being voided
/// * `market` - Reference to the market data
///
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error if claim creation fails
pub async fn create_dispute_refund_claims(
    market_id: &MarketId,
    market: &Market
) -> Result<(), ResolutionError> {
    ic_cdk::println!("Creating dispute refund claims for market {}", market_id);
    
    // Get all bets for this market
    let bets = crate::storage::get_bets_for_market(market_id);
    
    ic_cdk::println!("Found {} bets to process for resolution disagreement", bets.len());
    
    // If there are no bets, just return success
    if bets.is_empty() {
        return Ok(());
    }
    
    // For each bet, create a refund claim for the user (except creator's activation bet)
    let token_id = &market.token_id;
    let token_info = get_token_info(token_id)
        .ok_or_else(|| ResolutionError::MarketNotFound)?;
    let transfer_fee = &token_info.transfer_fee;
    let creator = market.creator;
    
    // Find the creator's activation bet
    let mut activation_bet_found = false;
    let mut activation_amount = None;
    
    // First pass: find the creator's activation bet
    for bet in &bets {
        if bet.user == creator {
            // If this is the creator's bet, we'll burn it
            if !activation_bet_found {
                // Only consider the first bet from the creator as the activation bet
                activation_bet_found = true;
                activation_amount = Some(bet.amount.clone());
                
                ic_cdk::println!(
                    "Found creator's activation bet of {} tokens. This amount will be burned.",
                    bet.amount
                );
            }
        }
    }
    
    // Burn the creator's activation deposit if found
    if let Some(amount) = activation_amount {
        // Get the minimum activation fee required for this token

        let min_activation_fee = crate::types::min_activation_bet(&token_info);
        
        // Calculate the amount to burn (only the min activation fee, not the entire deposit)
        // We need to ensure it's greater than the transfer fee
        if amount.clone() > transfer_fee.clone() {
            // If the activation deposit is more than required min activation fee + transfer fee,
            // the excess will be refunded
            let net_deposit = amount.clone() - transfer_fee.clone(); // Deposit minus transfer fee
            let burn_amount = if net_deposit.clone() > min_activation_fee.clone() {
                min_activation_fee.clone() // Only burn the minimum required amount
            } else {
                net_deposit.clone() // If less than min, burn whatever is available
            };
            
            // Calculate excess amount to refund (if any)
            let excess_amount = if net_deposit.clone() > min_activation_fee.clone() {
                net_deposit.clone() - min_activation_fee.clone() 
            } else {
                TokenAmount::from(0u64) // No excess if deposit was less than min required
            };
            
            // Burn the tokens by sending to minter
            ic_cdk::println!("Burning {} tokens of creator's deposit due to resolution disagreement", burn_amount);
            match burn_tokens(burn_amount.clone()).await {
                Err(e) => {
                    ic_cdk::println!("Error burning creator's deposit: {}", e);
                },
                Ok(tx_id) => {
                    ic_cdk::println!("Successfully burned {} tokens from creator's deposit (Transaction ID: {})", 
                                   burn_amount, tx_id);
                    
                    // If there's excess amount, create a refund claim for it
                    if !excess_amount.is_zero() {
                        ic_cdk::println!("Creator has excess deposit of {} tokens over required minimum. Creating refund claim.", excess_amount);
                        
                        let refund_reason = RefundReason::Other("DisputeExcessRefund".to_string());
                        
                        // Create a refund claim for the excess amount
                        let claim_id = create_refund_claim(
                            creator,
                            market_id.clone(),
                            excess_amount.clone(),
                            refund_reason,
                            excess_amount.clone(),
                            token_id.clone()
                        );
                        
                        ic_cdk::println!(
                            "Created refund claim {} for {} excess tokens to market creator {}",
                            claim_id,
                            excess_amount.clone(),
                            creator.to_string()
                        );
                    }
                }
            }
        } else {
            ic_cdk::println!(
                "Creator's deposit is too small to burn: {}. It's less than the transfer fee: {}",
                amount,
                transfer_fee
            );
        }
    } else {
        ic_cdk::println!("No activation bet found for creator. Nothing to burn.");
    }
    
    // Second pass: process refunds for all OTHER bets (not the creator's activation bet)
    let reason = "DisagreementVoid";
    let refund_reason = RefundReason::Other(reason.to_string());
    let mut first_creator_bet_processed = false;
    
    for bet in bets {
        // Skip the creator's first bet (activation bet)
        if bet.user == creator && !first_creator_bet_processed {
            first_creator_bet_processed = true;
            continue;
        }
        
        // For other bets (including creator's subsequent bets), create refund claims
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
        
        // Create a refund claim
        let claim_id = create_refund_claim(
            bet.user,
            market_id.clone(),
            bet.amount.clone(),
            refund_reason.clone(),
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
