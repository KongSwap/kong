use ic_cdk::update;

use super::resolution::*;

use crate::market::market::*;
use crate::stable_memory::*;
use crate::controllers::admin::*;
use crate::types::{MarketId, TokenAmount, TokenIdentifier};
use crate::token::registry::{get_token_info, is_supported_token};
use crate::token::transfer::transfer_token;

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

        // Transfer tokens back to the bettor using the appropriate token
        match transfer_token(bet.user, transfer_amount, token_id, None).await {
            Ok(_) => ic_cdk::println!("Transfer successful"),
            Err(e) => {
                ic_cdk::println!("Transfer failed: {:?}", e);
                return Err(ResolutionError::TransferError(format!("Failed to transfer tokens: {:?}", e)));
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
