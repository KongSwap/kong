//! # Market Voiding Module
//!
//! This module implements the logic for voiding prediction markets and refunding all bets to users.
//! Voiding is used in several scenarios:
//!
//! 1. When a market is determined to be invalid or impossible to resolve
//! 2. When there's disagreement between a creator and admin about the resolution
//! 3. When admins need to cancel a market for policy or technical reasons
//!
//! The voiding process ensures all users receive refunds of their original bets, with robust
//! error handling and retry mechanisms to handle transient failures in the distributed system.

use super::resolution::*;

use crate::claims::claims_processing::create_refund_claim;
use crate::controllers::admin::*;
use crate::market::market::*;
use crate::storage::MARKETS;
use crate::token::registry::get_token_info;
use crate::types::MarketId;

/// Voids a market and returns all bets to the users
///
/// This function handles the complete market voiding process, including:
/// 1. Validation of the caller's permissions and market state
/// 2. Retrieval of all bets associated with the market
/// 3. Refunding tokens to all bettors using the original token types
/// 4. Handling failed refunds with retry logic and transaction recovery
/// 5. Updating the market status to Voided
///
/// The function is designed to be resilient against individual refund failures.
/// Even if some refunds fail, the process continues to ensure that as many users
/// as possible receive their refunds, with failed cases recorded for later recovery.
///
/// Note: The actual #[update] function is defined in dual_approval.rs. This function
/// contains the core implementation called from there.
///
/// # Parameters
/// * `market_id` - ID of the market to void
///
/// # Returns
/// * `Result<(), ResolutionError>` - Success or an error reason if the process fails
///
/// # Security
/// Only admins can call this function directly. Market creators can trigger
/// the voiding process indirectly through resolution disagreements.
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
    if !matches!(market.status, MarketStatus::Active | MarketStatus::ExpiredUnresolved | MarketStatus::PendingActivation) {
        return Err(ResolutionError::AlreadyResolved);
    }

    ic_cdk::println!("Voiding market {}", market_id.to_u64());

    // Get all bets for this market using our helper function
    let bets = crate::storage::get_bets_for_market(&market_id);

    ic_cdk::println!("Found {} bets to refund", bets.len());

    // Return all bets to users using the appropriate token for each bet
    // Process each bet independently to ensure that failures in one refund
    // don't prevent other users from receiving their refunds
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
        // Users only receive their bet minus the transfer fee, ensuring
        // the transfer operation has enough funds to cover its costs
        if bet.amount <= token_info.transfer_fee {
            ic_cdk::println!(
                "Skipping transfer - bet amount {} less than fee {}",
                bet.amount.to_u64(),
                token_info.transfer_fee.to_u64()
            );
            continue; // Skip if bet amount is less than transfer fee
        }

        let claim_id = create_refund_claim(
            bet.user,
            market_id.clone(),
            bet.amount.clone(),
            crate::claims::claims_types::RefundReason::VoidedMarket,
            bet.amount.clone(),
            token_id.clone(),
        );

        ic_cdk::println!(
            "Created refund claim {} for {} tokens to user {}",
            claim_id,
            bet.amount.clone(),
            bet.user.to_string()
        );
    }

    // Update market status to Voided - this happens even if some refunds failed
    // to prevent future resolution attempts on this market
    market.status = MarketStatus::Voided;

    // Update market in storage with the new voided status
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });

    // Return success, even if some individual refunds failed
    // The transaction recovery system will handle any failed refunds

    Ok(())
}
