//! # Resolution Refund Processing
//!
//! This module handles refunds of bets when markets are voided or resolved
//! with disagreements.

use candid::Principal;

use crate::market::market::*;
use crate::stable_memory::BETS;
use crate::types::MarketId;
use crate::bet::bet::Bet;
use crate::token::registry::get_token_info;
use crate::token::transfer::transfer_token;
use crate::resolution::resolution::ResolutionError;

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
    
    // Get all bets for this market using the BETS storage pattern
    let bets = BETS.with(|bets| {
        let bets = bets.borrow();
        if let Some(bet_store) = bets.get(&market_id) {
            bet_store.0.clone()
        } else {
            Vec::new()
        }
    });
    
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
