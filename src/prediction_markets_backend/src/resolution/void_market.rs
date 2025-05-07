use super::resolution::*;

use crate::market::market::*;
use crate::stable_memory::*;
use crate::controllers::admin::*;
use crate::types::MarketId;
use crate::token::registry::{get_token_info, TokenIdentifier};
use crate::token::transfer::{transfer_token, TokenTransferError};
use crate::transaction_recovery::record_failed_transaction;

/// Helper function with retry logic specifically for void market refunds
async fn refund_with_retry(
    user: candid::Principal, 
    amount: crate::types::TokenAmount,
    token_id: &TokenIdentifier,
    retry_count: u8,
    market_id: &MarketId
) -> Result<Option<candid::Nat>, TokenTransferError> {
    let mut attempts = 0;
    let max_attempts = retry_count + 1; // Initial attempt + retries
    
    loop {
        attempts += 1;
        match transfer_token(user, amount.clone(), token_id, None).await {
            Ok(tx_id) => return Ok(Some(tx_id)),
            Err(e) if e.is_retryable() && attempts < max_attempts => {
                ic_cdk::println!("Refund attempt {} failed with retryable error: {}. Retrying...", 
                               attempts, e.detailed_message());
                // In a real implementation, you'd use a timer, but for simplicity we retry immediately
            },
            Err(e) => {
                ic_cdk::println!("Refund failed after {} attempts: {}",
                               attempts, e.detailed_message());
                
                // Record the failed transaction for potential recovery later
                let tx_id = record_failed_transaction(
                    Some(market_id.clone()),
                    user,
                    amount,
                    token_id.clone(),
                    e.detailed_message()
                );
                
                ic_cdk::println!("Recorded failed refund as transaction {}", tx_id);
                return Err(e);
            }
        }
    }
}

/// Voids a market and returns all bets to the users
/// This is used when no resolution can be determined or in case of market manipulation
/// Note: The actual #[update] function is defined in dual_approval.rs
pub async fn void_market(market_id: MarketId) -> Result<(), ResolutionError> {
    let admin = ic_cdk::caller();

    // Verify the caller is an admin
    if !is_admin(admin) {
        return Err(ResolutionError::Unauthorized);
    }

    // Get market and validate state
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound)
    })?;

    // Verify market is not already resolved
    if !matches!(market.status, MarketStatus::Active | MarketStatus::Disputed) {
        return Err(ResolutionError::AlreadyResolved);
    }

    ic_cdk::println!("Voiding market {}", market_id.to_u64());

    // Get all bets for this market
    let bets = BETS.with(|bets| {
        let bets = bets.borrow();
        if let Some(bet_store) = bets.get(&market_id) {
            bet_store.0.clone()
        } else {
            Vec::new()
        }
    });

    ic_cdk::println!("Found {} bets to refund", bets.len());

    // Return all bets to users using the appropriate token for each bet
    for bet in bets {
        // Get token info for the bet's token
        let token_id = &bet.token_id;
        let token_info = match get_token_info(token_id) {
            Some(info) => info,
            None => {
                ic_cdk::println!("Unsupported token: {}, skipping refund", token_id);
                continue;
            }
        };
        
        // Check if bet amount exceeds transfer fee for this token
        let transfer_amount = if bet.amount > token_info.transfer_fee {
            bet.amount - token_info.transfer_fee.clone()
        } else {
            ic_cdk::println!(
                "Skipping transfer - bet amount {} less than fee {}",
                bet.amount.to_u64(),
                token_info.transfer_fee.to_u64()
            );
            continue; // Skip if bet amount is less than transfer fee
        };

        ic_cdk::println!("Returning {} {} tokens to {}", 
                        transfer_amount.to_u64() / 10u64.pow(token_info.decimals as u32),
                        token_info.symbol,
                        bet.user.to_string());

        // Transfer tokens back to the bettor using our retry helper
        // Using 2 retries for recoverable errors
        match refund_with_retry(bet.user, transfer_amount, token_id, 2, &market_id).await {
            Ok(Some(tx_id)) => {
                ic_cdk::println!("Refund successful (Transaction ID: {})", tx_id);
            },
            Ok(None) => {
                ic_cdk::println!("Refund completed but no transaction ID returned");
            },
            Err(e) => {
                // Instead of failing the entire market voiding, log the error and continue with other refunds
                ic_cdk::println!("Refund failed: {}. Continuing with other refunds.", e.detailed_message());
                // Record the failure in the log but don't abort the market voiding process
            }
        }
    }

    // Update market status to Voided
    market.status = MarketStatus::Voided;
    
    // Update market in storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });

    Ok(())
}
