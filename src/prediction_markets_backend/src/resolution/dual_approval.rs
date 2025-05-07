//! # Dual Approval Resolution System
//! 
//! This module implements the market resolution system for Kong Swap prediction markets.
//! It supports two distinct resolution flows based on the market creator type:
//! 
//! 1. **Admin-Created Markets**: Can be resolved directly by any admin without requiring
//!    dual approval. When an admin resolves an admin-created market, the resolution is immediate.
//! 
//! 2. **User-Created Markets**: Require dual approval between the creator and an admin.
//!    The creator proposes a resolution first, then an admin must confirm with the same
//!    resolution. If there's a disagreement (admin proposes different outcomes), the market
//!    is voided and the creator's deposit is burned.
//!
//! This implementation ensures proper governance while maintaining efficiency for
//! admin-operated markets.

use candid::{Principal, Nat};
use ic_cdk::update;

use super::finalize_market::*;
use super::resolution::*;
use crate::controllers::admin::*;
use crate::market::market::*;
use crate::stable_memory::*;
use crate::types::{MarketId, TokenAmount, OutcomeIndex, min_activation_bet};
use crate::canister::get_current_time;
use crate::bet::bet::Bet;
use crate::token::registry::get_token_info;
use crate::token::transfer::{transfer_token, burn_tokens};

/// Refunds all bets when a market is voided
/// 
/// This function processes refunds for all bets placed on a voided market.
/// For each bet, it transfers the original bet amount (minus transfer fee)
/// back to the user who placed the bet. Failed transfers are logged but don't
/// stop the process - this ensures all users have an opportunity to receive
/// their refunds.
/// 
/// # Parameters
/// * `market` - Reference to the Market that is being voided
/// 
/// # Returns
/// * `Result<(), ResolutionError>` - Success indicator or error reason if the process fails
pub async fn refund_all_bets(market: &Market) -> Result<(), ResolutionError> {
    // Implementation will refund all bets to users
    ic_cdk::println!(
        "Voiding market {:?} and refunding all bets",
        market.id.to_u64()
    );
    
    // Get all bets for this market
    let bets = BETS.with(|bets| {
        let bets = bets.borrow();
        if let Some(bet_store) = bets.get(&market.id) {
            bet_store.0.clone()
        } else {
            Vec::new()
        }
    });

    ic_cdk::println!("Found {} bets to refund", bets.len());

    // For each bet, refund the tokens back to the user
    let token_id = &market.token_id;
    let token_info = get_token_info(token_id).unwrap_or_else(|| panic!("Invalid token ID"));
    let token_symbol = token_info.symbol.clone();
    let transfer_fee = &token_info.transfer_fee;
    
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

        if let Err(e) = transfer_token(bet.user, transfer_amount, token_id, None).await {
            // If transfer fails, log it but continue with others
            ic_cdk::println!("Error refunding bet to {}: {:?}", bet.user.to_string(), e);
        }
    }

    Ok(())
}

/// Determines if a user has authorization to resolve or propose resolution for a market
/// 
/// This function implements the authorization logic for market resolution:
/// - Admins can always resolve any market (admin-created directly, user-created via dual approval)
/// - Market creators can propose resolutions for markets they created
/// - The resolution method specified in the market is considered
/// 
/// # Parameters
/// * `market` - Reference to the Market being resolved
/// * `user` - Principal ID of the user attempting to resolve the market
/// 
/// # Returns
/// * `bool` - True if the user is authorized to resolve/propose for this market
pub fn can_resolve_market(market: &Market, user: Principal) -> bool {
    // Add detailed logging for debugging
    ic_cdk::println!("Checking if user {} can resolve market {}", user.to_string(), market.id.to_u64());
    ic_cdk::println!("Market creator: {}", market.creator.to_string());
    ic_cdk::println!("Resolution method: {:?}", market.resolution_method);
    ic_cdk::println!("Is user admin: {}", is_admin(user));
    ic_cdk::println!("Is creator admin: {}", is_admin(market.creator));
    ic_cdk::println!("Is user creator: {}", market.creator == user);
    
    // Check if market was created by an admin
    let _is_admin_created_market = is_admin(market.creator);
    
    // Admin can always resolve any market
    // - Admin-created markets can be resolved by any admin directly
    // - User-created markets require dual approval (admin + creator)
    if is_admin(user) {
        ic_cdk::println!("User is admin, authorization granted");
        return true;
    }
    
    // Creator can propose resolution for markets they created
    // For dual resolution, we allow the creator to propose regardless of resolution method
    if market.creator == user {
        ic_cdk::println!("User is the market creator, authorization granted");
        return true;
    }
    
    // Otherwise not authorized
    ic_cdk::println!("User is not authorized to resolve this market");
    false
}

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
#[update]
pub async fn propose_resolution(
    market_id: MarketId, 
    winning_outcomes: Vec<OutcomeIndex>
) -> Result<(), ResolutionError> {
    // Validate outcome indices are not empty
    if winning_outcomes.is_empty() {
        return Err(ResolutionError::InvalidOutcome);
    }
    
    let caller = ic_cdk::caller();
    let is_caller_admin = is_admin(caller);
    
    // Get market
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound)
    })?;
    
    // Check if market is active
    if !matches!(market.status, MarketStatus::Active) {
        return Err(ResolutionError::InvalidMarketStatus);
    }
    
    // Verify the market has ended
    let current_time = get_current_time();
    if current_time < market.end_time {
        return Err(ResolutionError::MarketStillOpen);
    }
    
    // Determine the caller's role in relation to this market
    // This information is crucial for implementing the correct resolution flow
    let is_caller_creator = market.creator == caller;  // Is caller the creator of this market?
    let is_market_creator_admin = is_admin(market.creator);  // Was this market created by an admin?
    
    // Check authorization - only creator or admin can propose resolutions
    // Use the can_resolve_market function to ensure proper authorization
    // Verify the caller has permission to resolve
    // This is a critical security check that enforces the dual approval governance model
    // - For admin-created markets: Only admins can resolve directly
    // - For user-created markets: Creator proposes first, then admin confirms
    if !can_resolve_market(&market, caller) {
        return Err(ResolutionError::Unauthorized);
    }
    
    // Special case: For admin-created markets, any admin can resolve directly without dual approval
    // RESOLUTION FLOW #1: Admin-Created Markets with Direct Resolution
    //
    // If this market was created by an admin AND an admin is resolving it,
    // we can bypass the dual approval process and resolve the market immediately.
    // This optimizes the flow for official/admin markets while maintaining security.
    //
    // Admin-created markets don't require dual approval because:
    // 1. They're considered official platform markets
    // 2. Admins are trusted entities in the governance system
    // 3. It enables faster resolution for standardized markets
    if is_market_creator_admin && is_caller_admin {
        ic_cdk::println!("Admin resolving admin-created market: bypassing dual approval");
        
        // Direct finalization - no proposal stage required
        finalize_market(&mut market, winning_outcomes.clone()).await?;
        
        // Update market status
        market.status = MarketStatus::Closed(winning_outcomes.iter().map(|idx| Nat::from(idx.clone())).collect());
        market.resolved_by = Some(caller);
        
        // Clone market_id before using it (to avoid ownership issues)
        let market_id_clone = market_id.clone();
        
        // Update market in storage
        MARKETS.with(|markets| {
            let mut markets_ref = markets.borrow_mut();
            markets_ref.insert(market_id_clone.clone(), market);
        });
        
        // Remove any existing resolution proposals
        RESOLUTION_PROPOSALS.with(|proposals| {
            let mut proposals = proposals.borrow_mut();
            proposals.remove(&market_id_clone);
        });
        
        return Ok(());
    }
    
    // Validate outcome indices are valid for this market
    for outcome_index in &winning_outcomes {
        let idx = outcome_index.to_u64() as usize;
        if idx >= market.outcomes.len() {
            return Err(ResolutionError::InvalidOutcome);
        }
    }
    
    // RESOLUTION FLOW #2: User-Created Markets with Dual Approval
    //
    // For markets created by regular users, we implement a dual approval system
    // to protect against fraudulent resolutions. This requires both the market
    // creator and an admin to agree on the same outcomes.
    //
    // The flow works as follows:
    // 1. First party (creator or admin) proposes a resolution with outcomes
    // 2. Second party (admin or creator) confirms with the same outcomes
    // 3. If outcomes match, market is finalized
    // 4. If outcomes differ, market is voided and creator's deposit is burned
    //
    // This ensures accountability for user-created markets while protecting
    // against manipulation or incorrect resolutions.
    
    // Check if a proposal already exists for this market
    let existing_proposal = RESOLUTION_PROPOSALS.with(|proposals| {
        // Use clone() on the Option instead of cloned() which is for iterators
        proposals.borrow().get(&market_id).clone()
    });
    
    // Handle dual approval based on whether a proposal already exists
    let _ = match existing_proposal {
        // First resolution step: No proposal exists yet, so create one
        None => {
            // Create a new resolution proposal recording who proposed it and with what outcomes
            let proposal = ResolutionProposal {
                market_id: market_id.clone(),
                proposed_outcomes: winning_outcomes.clone(),
                creator_approved: is_caller_creator,
                admin_approved: is_caller_admin,
                creator: market.creator,
                admin_approver: if is_caller_admin { Some(caller) } else { None },
                proposed_at: get_current_time()
            };
            
            // Store the proposal in stable memory so it persists across canister upgrades
            RESOLUTION_PROPOSALS.with(|proposals| {
                let mut proposals = proposals.borrow_mut();
                proposals.insert(market_id.clone(), proposal.clone());
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
                if proposal.proposed_outcomes == winning_outcomes {
                    // AGREEMENT: Both creator and admin agree on outcomes
                    ic_cdk::println!("Admin confirms creator's resolution outcomes. Finalizing market.");
                    
                    // Remove proposal since we're processing it
                    RESOLUTION_PROPOSALS.with(|proposals| {
                        let mut proposals = proposals.borrow_mut();
                        proposals.remove(&market_id);
                    });
                    
                    // Finalize the market with the agreed outcomes
                    return super::finalize_market::finalize_market(&mut market, winning_outcomes).await;
                } else {
                    // DISAGREEMENT: Admin disagrees with creator's proposed outcomes
                    ic_cdk::println!("Admin disagrees with creator's resolution. Voiding market.");
                    
                    // In case of disagreement, void the market and burn creator's deposit
                    // as a penalty for incorrect resolution
                    return handle_resolution_disagreement(market_id, market, proposal).await;
                }
            }
            
            // DUAL APPROVAL SCENARIO 2: Admin proposed first, now creator reviewing
            else if admin_already_approved && is_caller_creator && !creator_already_approved {
                ic_cdk::println!("Creator reviewing admin's resolution proposal");
                
                // Check if creator's outcomes match admin's proposed outcomes
                if proposal.proposed_outcomes == winning_outcomes {
                    // AGREEMENT: Both admin and creator agree on outcomes
                    ic_cdk::println!("Creator confirms admin's resolution outcomes. Finalizing market.");
                    
                    // Remove proposal since we're processing it
                    RESOLUTION_PROPOSALS.with(|proposals| {
                        let mut proposals = proposals.borrow_mut();
                        proposals.remove(&market_id);
                    });
                    
                    // Finalize the market with the agreed outcomes
                    return super::finalize_market::finalize_market(&mut market, winning_outcomes).await;
                } else {
                    // DISAGREEMENT: Creator disagrees with admin's proposed outcomes
                    ic_cdk::println!("Creator disagrees with admin's resolution. Voiding market.");
                    
                    // In case of disagreement, void the market and burn creator's deposit
                    // as a penalty for incorrect resolution
                    return handle_resolution_disagreement(market_id, market, proposal).await;
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
    // Use AwaitingAdminApproval from the ResolutionError enum instead of the
    // non-existent AwaitingApproval variant.
    Err(ResolutionError::AwaitingAdminApproval)
}

/// Allows an admin to force resolve a market, bypassing the dual-approval process
#[update]
pub async fn force_resolve_market(
    market_id: MarketId,
    winning_outcomes: Vec<OutcomeIndex>
) -> Result<(), ResolutionError> {
    // Validate outcome indices are not empty
    if winning_outcomes.is_empty() {
        return Err(ResolutionError::InvalidOutcome);
    }
    
    let admin = ic_cdk::caller();
    
    // Verify the caller is an admin
    if !is_admin(admin) {
        return Err(ResolutionError::Unauthorized);
    }
    
    // Get the market
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound)
    })?;
    
    // Check if market can be resolved - only Active markets can be force resolved
    if !matches!(market.status, MarketStatus::Active | MarketStatus::Disputed) {
        return Err(ResolutionError::InvalidMarketStatus);
    }
    
    // Validate outcome indices are valid for this market
    for outcome_index in &winning_outcomes {
        let idx = outcome_index.to_u64() as usize;
        if idx >= market.outcomes.len() {
            return Err(ResolutionError::InvalidOutcome);
        }
    }
    
    // Finalize the market - distribute winnings
    finalize_market(&mut market, winning_outcomes.clone()).await?;
    
    // Update market status
    market.status = MarketStatus::Closed(winning_outcomes.iter().map(|idx| Nat::from(idx.clone())).collect());
    market.resolved_by = Some(admin);
    
    // Remove any existing resolution proposals
    RESOLUTION_PROPOSALS.with(|proposals| {
        let mut proposals = proposals.borrow_mut();
        proposals.remove(&market_id);
    });
    
    // Update market in storage
    // Clone market_id before moving it into the closure
    let market_id_clone = market_id.clone();
    
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });
    
    ic_cdk::println!(
        "Admin {} force resolved market {:?}",
        admin.to_string(),
        market_id_clone.to_u64()
    );
    
    Ok(())
}

/// Handle resolution disagreement by voiding the market
/// 
/// When there's a disagreement between the market creator and admin about the
/// correct market resolution outcomes, this function:
/// 1. Burns the creator's minimum bet deposit (3000 KONG) as a penalty
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
async fn handle_resolution_disagreement(
    market_id: MarketId,
    mut market: Market,
    proposal: ResolutionProposal
) -> Result<(), ResolutionError> {
    ic_cdk::println!(
        "Resolution disagreement for market {:?}. Voiding market and burning creator's deposit.",
        market_id.to_u64()
    );
    
    // Identify the market creator
    let creator = market.creator;
    
    // Get all bets for this market
    let bets = BETS.with(|bets| {
        let bets = bets.borrow();
        if let Some(bet_store) = bets.get(&market_id) {
            bet_store.0.clone()
        } else {
            Vec::new()
        }
    });
    
    ic_cdk::println!("Found {} bets to process for market void", bets.len());
    
    // Split bets into creator bets and other bets
    let mut creator_bets: Vec<Bet> = Vec::new();
    let mut other_bets: Vec<Bet> = Vec::new();
    
    for bet in bets {
        if bet.user == creator {
            creator_bets.push(bet);
        } else {
            other_bets.push(bet);
        }
    }
    
    // Calculate the total amount to burn (up to min_activation_bet() for this token)
    let mut amount_to_burn = TokenAmount::from(0u64);
    let mut creator_remaining = TokenAmount::from(0u64);
    let activation_threshold = min_activation_bet(&market.token_id);
    
    for bet in &creator_bets {
        if amount_to_burn.clone() < activation_threshold.clone() {
            let to_burn = if amount_to_burn.clone() + bet.amount.clone() <= activation_threshold.clone() {
                bet.amount.clone()
            } else {
                activation_threshold.clone() - amount_to_burn.clone()
            };
            
            amount_to_burn = amount_to_burn.clone() + to_burn.clone();
            
            // If there's remaining amount from this bet, add it to creator_remaining
            if bet.amount.clone() > to_burn.clone() {
                creator_remaining = creator_remaining.clone() + (bet.amount.clone() - to_burn.clone());
            }
        } else {
            // We've already reached the amount to burn, add the rest to creator_remaining
            creator_remaining = creator_remaining.clone() + bet.amount.clone();
        }
    }
    
    // Burn the tokens by sending them to the minter address
    if amount_to_burn.clone() > TokenAmount::from(0u64) {
        let amount_to_burn_clone = amount_to_burn.clone();
        let token_id = &market.token_id;
        let token_info = get_token_info(token_id).unwrap_or_else(|| panic!("Invalid token ID"));
        
        // Get token symbol for logging
        let token_symbol = token_info.symbol.clone();
        
        match burn_tokens(token_id, amount_to_burn).await {
            Ok(_) => {
                // Display amount in token's native format
                let display_amount = amount_to_burn_clone.to_u64() / 10u64.pow(token_info.decimals as u32);
                ic_cdk::println!("Burned {} {} from market creator as penalty", display_amount, token_symbol);
            },
            Err(e) => {
                ic_cdk::println!("Error burning tokens: {:?}", e);
                // Continue even if burning fails - we'll still void the market
            }
        }
    }
    
    // Return any remaining tokens to the creator
    if creator_remaining.clone() > TokenAmount::from(0u64) {
        let token_id = &market.token_id;
        let token_info = get_token_info(token_id).unwrap_or_else(|| panic!("Invalid token ID"));
        
        // Check if amount exceeds transfer fee
        if creator_remaining.clone() > token_info.transfer_fee.clone() {
            let transfer_amount = creator_remaining.clone() - token_info.transfer_fee.clone();
            let transfer_amount_clone = transfer_amount.clone();
            let token_symbol = token_info.symbol.clone();
            
            match transfer_token(creator, transfer_amount, token_id, None).await {
                Ok(_) => {
                    // Display amount in token's native format
                    let display_amount = transfer_amount_clone.to_u64() / 10u64.pow(token_info.decimals as u32);
                    ic_cdk::println!("Refunded {} {} remaining to market creator", display_amount, token_symbol);
                },
                Err(e) => {
                    ic_cdk::println!("Error refunding creator: {:?}", e);
                    // Continue even if refund fails
                }
            }
        }
    }
    
    // Refund all other users' bets
    for bet in other_bets {
        let token_id = &market.token_id;
        let token_info = get_token_info(token_id).unwrap_or_else(|| panic!("Invalid token ID"));
        let token_symbol = token_info.symbol.clone();
        let transfer_fee = &token_info.transfer_fee;
        
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
        
        if let Err(e) = transfer_token(bet.user, transfer_amount, token_id, None).await {
            // If transfer fails, log it but continue with others
            ic_cdk::println!("Error refunding bet to {}: {:?}", bet.user.to_string(), e);
        }
    }
    
    // Remove the resolution proposal
    RESOLUTION_PROPOSALS.with(|proposals| {
        let mut proposals = proposals.borrow_mut();
        proposals.remove(&market_id);
    });
    
    // Update market status to voided
    market.status = MarketStatus::Voided;
    market.resolved_by = proposal.admin_approver;
    
    // Update market in storage
    let market_id_clone = market_id.clone();
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id_clone.clone(), market);
    });
    
    ic_cdk::println!("Market voided due to resolution disagreement");
    
    // Return appropriate error to signal disagreement
    Err(ResolutionError::ResolutionDisagreement)
}

/// Resolve the market through admin decision
/// 
/// This is a public API endpoint that aliases to the propose_resolution function, maintaining
/// backward compatibility while ensuring the dual approval system is followed.
/// 
/// For admin-created markets: immediate resolution by any admin
/// For user-created markets: requires dual approval between creator and admin
/// 
/// # Parameters
/// * `market_id` - ID of the market to resolve
/// * `winning_outcomes` - Vector of outcome indices that won
/// 
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error reason if the resolution fails
/// 
/// # Security
/// Only market creators and admins can call this function successfully.
#[update]
pub async fn resolve_via_admin(
    market_id: MarketId, 
    winning_outcomes: Vec<OutcomeIndex>
) -> Result<(), ResolutionError> {
    let caller = ic_cdk::caller();
    
    // Only admins can call this function
    if !is_admin(caller) {
        return Err(ResolutionError::Unauthorized);
    }
    
    // Use the propose_resolution function which will automatically handle admin vs user markets
    propose_resolution(market_id, winning_outcomes).await
}

/// Voids a market and refunds all bets to users
/// 
/// This function allows admins to void a market (due to ambiguous resolution,
/// technical issues, or other reasons) and ensure all users receive refunds of
/// their original bets. Unlike the disagreement handler, this does not burn
/// the creator's deposit.
/// 
/// # Parameters
/// * `market_id` - ID of the market to void
/// 
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error reason if the process fails
/// 
/// # Security
/// Only admins can call this function.
#[update]
pub async fn void_market(
    market_id: MarketId
) -> Result<(), ResolutionError> {
    let admin = ic_cdk::caller();
    
    // Verify the caller is an admin
    if !is_admin(admin) {
        return Err(ResolutionError::Unauthorized);
    }
    
    // Get the market
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound)
    })?;
    
    // Check if market can be voided - only Pending or Active markets can be voided
    if !matches!(market.status, MarketStatus::Pending | MarketStatus::Active | MarketStatus::Disputed) {
        return Err(ResolutionError::InvalidMarketStatus);
    }
    
    // Process the void - refund all bets
    // Only process refunds if there are bets (Active markets)
    if matches!(market.status, MarketStatus::Active) {
        if let Err(_e) = refund_all_bets(&market).await {
            ic_cdk::println!("Error refunding bets");
            // Continue even if refunds fail
        }
    }
    
    // Remove any existing resolution proposals
    RESOLUTION_PROPOSALS.with(|proposals| {
        let mut proposals = proposals.borrow_mut();
        proposals.remove(&market_id);
    });
    
    // Update market status
    market.status = MarketStatus::Voided;
    market.resolved_by = Some(admin);
    
    // Update market in storage
    let market_id_clone = market_id.clone();
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id_clone.clone(), market);
    });
    
    ic_cdk::println!(
        "Market {:?} voided by admin",
        market_id_clone.to_u64()
    );
    
    Ok(())
}
