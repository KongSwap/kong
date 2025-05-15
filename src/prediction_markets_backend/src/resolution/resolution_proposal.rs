//! # Resolution Proposal Management
//!
//! This module manages the creation, validation, and processing of 
//! market resolution proposals for the dual approval system.

use candid::Principal;
use ic_cdk::update;

use crate::resolution::resolution_auth::*;
use crate::resolution::resolution_actions::*;
use crate::resolution::resolution_refunds::*;
use crate::resolution::finalize_market::finalize_market;
use crate::resolution::resolution::*;
use crate::controllers::admin::*;
use crate::market::market::*;
use crate::stable_memory::*;
use crate::canister::get_current_time;
use crate::token::registry::get_token_info;
use crate::token::transfer::burn_tokens;
use crate::types::ResolutionArgs;

/// Proposes or executes a resolution for a market
///
/// This function implements the dual resolution system with two distinct resolution flows:
///
/// 1. **Admin-Created Markets**: When an admin calls this function for a market created by any admin,
///    the resolution is immediate. The market is finalized directly without requiring a second approval.
///
/// 2. **User-Created Markets**: Requires dual approval between the creator and an admin.
///    - When a creator proposes first, it's recorded as a proposal waiting for admin confirmation
///    - When an admin proposes first, it's recorded as a proposal waiting for creator confirmation
///    - When the second party proposes matching outcomes, the market is finalized
///    - When the second party proposes different outcomes, the market is voided and creator's deposit burned
///
/// # Parameters
/// * `market_id` - ID of the market to resolve
/// * `winning_outcomes` - Vector of outcome indices that won (multiple allowed for multi-select markets)
///
/// # Returns
/// * `Result<(), ResolutionError>` - Success or failure with error reason
///
/// # Security
/// Only market creators and admins can call this function. For admin-created markets,
/// only admins can resolve. For user-created markets, both the creator and an admin
/// must agree on the outcome.
// Note: #[update] attribute removed to avoid conflict with the original function in dual_approval.rs
pub async fn propose_resolution(
    args: ResolutionArgs
) -> Result<(), ResolutionError> {
    // Validate outcome indices are not empty
    if args.winning_outcomes.is_empty() {
        return Err(ResolutionError::InvalidOutcome);
    }
    
    let caller = ic_cdk::caller();
    let is_caller_admin = is_admin(caller);
    
    // Get market
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&args.market_id).ok_or(ResolutionError::MarketNotFound)
    })?;
    
    // Check if market is active
    if !matches!(market.status, MarketStatus::Active) {
        return Err(ResolutionError::InvalidMarketStatus);
    }
    
    // Verify the market has ended
    let current_time = get_current_time();
    if !has_market_ended(&market, current_time.into()) {
        return Err(ResolutionError::MarketStillOpen);
    }
    
    // Determine the caller's role in relation to this market
    let is_caller_creator = market.creator == caller;  // Is caller the creator of this market?
    let is_market_creator_admin = is_admin(market.creator);  // Was this market created by an admin?
    
    // Check authorization - only creator or admin can propose resolutions
    if !can_resolve_market(&market, caller) {
        return Err(ResolutionError::Unauthorized);
    }
    
    // Special case: For admin-created markets, any admin can resolve directly without dual approval
    if is_market_creator_admin && is_caller_admin {
        ic_cdk::println!("Admin resolving admin-created market: bypassing dual approval");
        
        // Use the direct resolution function from resolution_actions
        return resolve_market_directly(args, &mut market, caller).await;
    }
    
    // Validate outcome indices are valid for this market
    for outcome_index in &args.winning_outcomes {
        let idx = outcome_index.to_u64() as usize;
        if idx >= market.outcomes.len() {
            return Err(ResolutionError::InvalidOutcome);
        }
    }
    
    // DUAL APPROVAL FLOW FOR USER-CREATED MARKETS
    
    // Check if a proposal already exists for this market
    let existing_proposal = RESOLUTION_PROPOSALS.with(|proposals| {
        // Use clone() on the Option instead of cloned() which is for iterators
        proposals.borrow().get(&args.market_id).clone()
    });
    
    // Handle dual approval based on whether a proposal already exists
    let _ = match existing_proposal {
        // First resolution step: No proposal exists yet, so create one
        None => {
            // Create a new resolution proposal recording who proposed it and with what outcomes
            let proposal = ResolutionProposal {
                market_id: args.market_id.clone(),
                proposed_outcomes: args.winning_outcomes.clone(),
                creator_approved: is_caller_creator,
                admin_approved: is_caller_admin,
                creator: market.creator,
                admin_approver: if is_caller_admin { Some(caller) } else { None },
                proposed_at: get_current_time()
            };
            
            // Store the proposal in stable memory so it persists across canister upgrades
            RESOLUTION_PROPOSALS.with(|proposals| {
                let mut proposals = proposals.borrow_mut();
                proposals.insert(args.market_id.clone(), proposal.clone());
            });
            
            // Provide appropriate feedback based on who initiated the proposal
            if is_caller_creator {
                ic_cdk::println!("Market creator proposed resolution, waiting for admin confirmation");
                Ok(())
            } else {
                ic_cdk::println!("Admin proposed resolution, waiting for creator confirmation");
                Ok(())
            }
        },
        // Second resolution step: Proposal exists, now checking for agreement/disagreement
        Some(proposal) => {
            // Check who previously approved this proposal
            let creator_already_approved = proposal.creator_approved;
            let admin_already_approved = proposal.admin_approved;
            
            // DUAL APPROVAL SCENARIO 1: Creator proposed first, now admin reviewing
            if creator_already_approved && is_caller_admin && !admin_already_approved {
                ic_cdk::println!("Admin reviewing creator's resolution proposal");
                
                // Check if admin's outcomes match creator's proposed outcomes
                if proposal.proposed_outcomes == args.winning_outcomes {
                    // AGREEMENT: Both creator and admin agree on outcomes
                    ic_cdk::println!("Admin confirms creator's resolution outcomes. Finalizing market.");
                    
                    // Remove proposal since we're processing it
                    RESOLUTION_PROPOSALS.with(|proposals| {
                        let mut proposals = proposals.borrow_mut();
                        proposals.remove(&args.market_id);
                    });
                    
                    // Finalize the market with the agreed outcomes
                    return finalize_market(&mut market, args.winning_outcomes).await;
                } else {
                    // DISAGREEMENT: Admin disagrees with creator's proposed outcomes
                    ic_cdk::println!("Admin disagrees with creator's resolution. Voiding market.");
                    
                    // In case of disagreement, void the market and burn creator's deposit
                    // as a penalty for incorrect resolution
                    return handle_resolution_disagreement(args, market, proposal).await;
                }
            }
            
            // DUAL APPROVAL SCENARIO 2: Admin proposed first, now creator reviewing
            else if admin_already_approved && is_caller_creator && !creator_already_approved {
                ic_cdk::println!("Creator reviewing admin's resolution proposal");
                
                // Check if creator's outcomes match admin's proposed outcomes
                if proposal.proposed_outcomes == args.winning_outcomes {
                    // AGREEMENT: Both admin and creator agree on outcomes
                    ic_cdk::println!("Creator confirms admin's resolution outcomes. Finalizing market.");
                    
                    // Remove proposal since we're processing it
                    RESOLUTION_PROPOSALS.with(|proposals| {
                        let mut proposals = proposals.borrow_mut();
                        proposals.remove(&args.market_id);
                    });
                    
                    // Finalize the market with the agreed outcomes
                    return finalize_market(&mut market, args.winning_outcomes).await;
                } else {
                    // DISAGREEMENT: Creator disagrees with admin's proposed outcomes
                    ic_cdk::println!("Creator disagrees with admin's resolution. Voiding market.");
                    
                    // In case of disagreement, void the market and burn creator's deposit
                    // as a penalty for incorrect resolution
                    return handle_resolution_disagreement(args, market, proposal).await;
                }
            } else {
                // Edge case: this covers scenarios like both parties already approved,
                // or other unexpected states. Included for security and completeness.
                ic_cdk::println!("Unexpected approval state: creator_approved={}, admin_approved={}, caller_is_creator={}, caller_is_admin={}", 
                              creator_already_approved, admin_already_approved, is_caller_creator, is_caller_admin);
                Err(ResolutionError::Unauthorized)
            }
        },
    };

    // Given dual approval paths should have returned earlier, so if we reach here,
    // we assume we're waiting for admin approval in the dual approval flow.
    Err(ResolutionError::AwaitingAdminApproval)
}

/// Handles resolution disagreement by voiding the market
///
/// When there's a disagreement between the market creator and admin about the
/// correct market resolution outcomes, this function:
/// 1. Burns the creator's minimum bet deposit (activation amount) as a penalty
/// 2. Refunds all other bets to their respective users
/// 3. Marks the market as voided due to resolution disagreement
///
/// This ensures accountability while protecting users who placed bets on the market.
///
/// # Parameters
/// * `market_id` - ID of the market with resolution disagreement
/// * `market` - The market data structure to be updated
/// * `proposal` - The resolution proposal containing disagreement details
///
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error reason if the process fails
pub async fn handle_resolution_disagreement(
    args: ResolutionArgs,
    mut market: Market,
    proposal: ResolutionProposal
) -> Result<(), ResolutionError> {
    // Log the disagreement
    ic_cdk::println!(
        "Resolution disagreement detected for market {}. Creator: {}, Admin: {}",
        args.market_id, 
        proposal.creator,
        proposal.admin_approver.unwrap_or_else(|| Principal::anonymous())
    );
    
    // Get token information
    let token_id = &market.token_id;
    let token_info = get_token_info(token_id)
        .ok_or(ResolutionError::MarketNotFound)?;
        
    // Calculate the creator's deposit amount using the min_activation_bet function
    let activation_amount = crate::types::min_activation_bet(token_id);
    
    // Log burn amount
    ic_cdk::println!(
        "Burning creator's deposit of {} {} tokens as penalty for incorrect resolution",
        activation_amount.to_u64() / 10u64.pow(token_info.decimals as u32),
        token_info.symbol
    );
    
    // Burn the creator's deposit as penalty for incorrect resolution
    // This is to discourage creators from proposing incorrect resolutions
    let burn_result = burn_tokens(
        token_id,
        activation_amount
    ).await;
    
    if let Err(err) = burn_result {
        ic_cdk::println!("Error burning creator deposit: {:?}", err);
        // Continue despite burn error to ensure users get refunds
    }
    
    // Process refunds for all betters EXCEPT the activation deposit
    refund_all_bets(&args.market_id, &market).await?;
    
    // Update market status to voided due to resolution disagreement
    market.status = MarketStatus::Voided;
    // Note: Market doesn't have a closed_at field in this implementation
    
    // Log market status change
    ic_cdk::println!("Market {} has been voided due to resolution disagreement", args.market_id);
    
    // Clone market_id for insertion to avoid ownership issues
    let market_id_clone = args.market_id.clone();
    
    // Update market in storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id_clone, market);
    });
    
    // Remove the resolution proposal
    RESOLUTION_PROPOSALS.with(|proposals| {
        let mut proposals = proposals.borrow_mut();
        proposals.remove(&args.market_id);
    });
    
    Ok(())
}

/// Helper function to check if a market has ended
fn has_market_ended(market: &Market, current_time: u64) -> bool {
    // Compare the current_time with the market's end_time
    // Convert StorableNat to u64 for comparison
    let end_time_u64: u64 = market.end_time.clone().into(); // Use the Into trait to convert StorableNat to u64
    current_time >= end_time_u64
}
