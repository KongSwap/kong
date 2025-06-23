//! # Resolution Refund Processing
//!
//! This module handles refunds of bets when markets are voided or resolved
//! with disagreements.
//!
//! Special handling is implemented for resolution disagreements, where the creator's
//! deposit is burned (sent to minter) rather than refunded.

use crate::canister::get_current_time;
use crate::claims::claims_processing::create_refund_claim;
use crate::claims::claims_types::RefundReason;
use crate::market::market::*;
use crate::resolution::resolution::ResolutionError;
use crate::token::registry::get_token_info;
use crate::token::transfer::{handle_fee_transfer, handle_fee_transfer_failure};
use crate::types::{MarketId, TokenAmount};

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
pub fn create_refund_claims(market_id: &MarketId, market: &Market, reason: &str) -> Result<(), ResolutionError> {
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
    let token_info = get_token_info(token_id).ok_or_else(|| ResolutionError::MarketNotFound)?;
    let transfer_fee = &token_info.transfer_fee;
    // Current time is not used in this function
    let _current_time = get_current_time();

    // Process refund claims for each bet
    for bet in bets {
        // Ensure we don't try to claim less than the transfer fee
        if bet.amount.clone() <= transfer_fee.clone() {
            ic_cdk::println!(
                "Cannot create refund claim for {} to {}: amount is less than transfer fee",
                bet.amount,
                bet.user.to_string()
            );
            continue; // Skip if bet amount is less than transfer fee
        }

        // Create a refund claim for this bet
        let refund_reason = RefundReason::Other(reason.to_string());

        // Create a refund claim - returns claim ID directly as u64
        let claim_id = create_refund_claim(
            bet.user,
            market_id.clone(),
            bet.amount.clone(),
            refund_reason,
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
pub async fn create_dispute_refund_claims(market_id: &MarketId, market: &Market) -> Result<(), ResolutionError> {
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
    let token_info = get_token_info(token_id).ok_or_else(|| ResolutionError::MarketNotFound)?;
    let transfer_fee = &token_info.transfer_fee;
    let creator = market.creator;

    // Find the creator's activation bet
    let mut activation_amount = None;

    // First pass: find the creator's activation bet
    for bet in &bets {
        if bet.user == creator {
            // If this is the creator's bet, we'll burn it
            // Only consider the first bet from the creator as the activation bet
            activation_amount = Some(bet.amount.clone());

            ic_cdk::println!(
                "Found creator's activation bet of {} tokens. This amount will be burned.",
                bet.amount
            );
            break;
        }
    }

    // Burn the creator's activation deposit if found
    if let Some(amount) = activation_amount {
        // Get the minimum activation fee required for this token

        let min_activation_fee = crate::types::min_activation_bet(&token_info);

        // Calculate the amount to burn (only the min activation fee, not the entire deposit)
        // We need to ensure it's greater than the transfer fee
        if amount.clone() <= transfer_fee.clone() {
            ic_cdk::println!(
                "Creator's deposit is too small to burn: {}. It's less than the transfer fee: {}",
                amount,
                transfer_fee
            );
        } else {
            // If the activation deposit is more than required min activation fee + transfer fee,
            // the excess will be refunded
            let net_deposit = amount.clone();

            // Calculate excess amount to refund (if any)
            let excess_amount = if net_deposit.clone() > min_activation_fee.clone() {
                net_deposit.clone() - min_activation_fee.clone()
            } else {
                TokenAmount::from(0u64) // No excess if deposit was less than min required
            };

            // Burn the tokens by sending to minter
            ic_cdk::println!("Burning {} tokens of creator's deposit due to resolution disagreement", net_deposit);
            match handle_fee_transfer(min_activation_fee.clone(), token_id).await {
                Err(e) => {
                    ic_cdk::println!("Error burning creator's deposit: {:?}", e);
                    // Record failed transaction.
                    handle_fee_transfer_failure(market.id.clone(), min_activation_fee.clone(), &token_info, e);
                }
                Ok(block_id) => {
                    ic_cdk::println!(
                        "Successfully burned {} tokens from creator's deposit (Block ID: {})",
                        net_deposit,
                        block_id.unwrap_or(candid::Nat::default())
                    );

                    // If there's excess amount, create a refund claim for it
                    if !excess_amount.is_zero() {
                        ic_cdk::println!(
                            "Creator has excess deposit of {} tokens over required minimum. Creating refund claim.",
                            excess_amount
                        );

                        let refund_reason = RefundReason::Other("DisputeExcessRefund".to_string());

                        // Create a refund claim for the excess amount
                        let claim_id = create_refund_claim(
                            creator,
                            market_id.clone(),
                            excess_amount.clone(),
                            refund_reason,
                            excess_amount.clone(),
                            token_id.clone(),
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
            bet.amount.clone()
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
            token_id.clone(),
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
