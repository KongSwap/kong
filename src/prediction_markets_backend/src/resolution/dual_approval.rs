use candid::{Principal, Nat};
use ic_cdk::update;

use super::finalize_market::*;
use super::resolution::*;
use super::transfer_kong::*;
use crate::controllers::admin::*;
use crate::market::market::*;
use crate::nat::StorableNat;
use crate::stable_memory::*;
use crate::types::{MarketId, TokenAmount, OutcomeIndex, Timestamp, min_activation_bet};
use crate::canister::get_current_time;
use crate::bet::bet::Bet;

lazy_static::lazy_static! {
    static ref KONG_TRANSFER_FEE: TokenAmount = TokenAmount::from(10_000u64); // 0.0001 KONG
}

/// Refunds all bets when a market is voided
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

    // Return all bets to users
    for bet in bets {
        let transfer_amount = if bet.amount > KONG_TRANSFER_FEE.clone() {
            bet.amount - KONG_TRANSFER_FEE.clone()
        } else {
            ic_cdk::println!(
                "Skipping transfer - bet amount {} less than fee {}",
                bet.amount.to_u64(),
                KONG_TRANSFER_FEE.to_u64()
            );
            continue; // Skip if bet amount is less than transfer fee
        };

        ic_cdk::println!("Returning {} tokens to {}", transfer_amount.to_u64(), bet.user.to_string());

        if let Err(e) = transfer_kong(bet.user, transfer_amount).await {
            // If transfer fails, log it but continue with others
            ic_cdk::println!("Error refunding bet to {}: {}", bet.user.to_string(), e);
        }
    }

    Ok(())
}

/// Determines if a user can resolve a market
pub fn can_resolve_market(market: &Market, user: Principal) -> bool {
    // Admin can always resolve any market
    if is_admin(user) {
        return true;
    }
    
    // Creator can propose resolution if resolution method is Admin and they created the market
    if market.creator == user && matches!(market.resolution_method, ResolutionMethod::Admin) {
        return true;
    }
    
    // Otherwise not authorized
    false
}

/// Proposes resolution for a market (implements dual-approval for user-created markets)
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
    
    let is_caller_creator = market.creator == caller;
    
    // Check authorization - only creator or admin can propose resolutions
    if !is_caller_admin && !is_caller_creator {
        return Err(ResolutionError::Unauthorized);
    }
    
    // Validate outcome indices are valid for this market
    for outcome_index in &winning_outcomes {
        let idx = outcome_index.to_u64() as usize;
        if idx >= market.outcomes.len() {
            return Err(ResolutionError::InvalidOutcome);
        }
    }
    
    // Check existing proposals or create a new one
    RESOLUTION_PROPOSALS.with(|proposals| {
        let mut proposals = proposals.borrow_mut();
        
        if let Some(existing_proposal) = proposals.get(&market_id) {
            let mut proposal = existing_proposal.clone();
            
            // Check if proposed outcomes match
            if proposal.proposed_outcomes != winning_outcomes {
                // If outcomes don't match and both creator and admin have submitted proposals,
                // this is a disagreement that requires the market to be voided
                if (is_caller_admin && proposal.creator_approved) || 
                   (is_caller_creator && proposal.admin_approved) {
                    // This is a disagreement - void the market and burn creator's deposit
                    return handle_resolution_disagreement(market_id, market, proposal).await;
                }
                
                // If it's not a confirmed disagreement yet, just inform about mismatch
                return Err(ResolutionError::ResolutionMismatch);
            }
            
            // Handle creator approval
            if is_caller_creator && !proposal.creator_approved {
                proposal.creator_approved = true;
            }
            
            // Handle admin approval
            if is_caller_admin && !proposal.admin_approved {
                proposal.admin_approved = true;
                proposal.admin_approver = Some(caller);
            }
            
            // Check if we have dual approval
            if proposal.creator_approved && proposal.admin_approved {
                // Finalize the market - this distributes winnings
                finalize_market(&mut market, winning_outcomes.clone()).await?;
                
                // Update market status
                market.status = MarketStatus::Closed(winning_outcomes.iter().map(|idx| Nat::from(idx.clone())).collect());
                market.resolved_by = proposal.admin_approver;
                
                // Update market in storage
                MARKETS.with(|markets| {
                    let mut markets_ref = markets.borrow_mut();
                    markets_ref.insert(market_id, market);
                });
                
                // Remove proposal
                proposals.remove(&market_id);
                
                ic_cdk::println!(
                    "Market {:?} resolved with dual approval",
                    market_id.to_u64()
                );
            } else {
                // Update proposal
                proposals.insert(market_id, proposal);
                
                // Inform if waiting for the other party
                if proposal.creator_approved && !proposal.admin_approved {
                    return Err(ResolutionError::AwaitingAdminApproval);
                } else if !proposal.creator_approved && proposal.admin_approved {
                    return Err(ResolutionError::AwaitingCreatorApproval);
                }
            }
        } else {
            // Create new proposal
            let proposal = ResolutionProposal {
                market_id: market_id.clone(),
                proposed_outcomes: winning_outcomes.clone(),
                creator_approved: is_caller_creator,
                admin_approved: is_caller_admin,
                creator: market.creator,
                admin_approver: if is_caller_admin { Some(caller) } else { None },
                proposed_at: get_current_time(),
            };
            
            proposals.insert(market_id, proposal.clone());
            
            // Inform about waiting for approval
            if proposal.creator_approved && !proposal.admin_approved {
                return Err(ResolutionError::AwaitingAdminApproval);
            } else if !proposal.creator_approved && proposal.admin_approved {
                return Err(ResolutionError::AwaitingCreatorApproval);
            }
        }
        
        Ok(())
    })
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
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });
    
    ic_cdk::println!(
        "Admin {} force resolved market {:?}",
        admin.to_string(),
        market_id.to_u64()
    );
    
    Ok(())
}

/// Handle resolution disagreement by voiding the market
/// Burns the creator's 3000 KONG minimum bet and refunds all other bets
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
    
    // Calculate the total amount to burn (up to min_activation_bet())
    let mut amount_to_burn = TokenAmount::from(0u64);
    let mut creator_remaining = TokenAmount::from(0u64);
    let activation_threshold = min_activation_bet();
    
    for bet in &creator_bets {
        if amount_to_burn < activation_threshold {
            let to_burn = if amount_to_burn + bet.amount <= activation_threshold {
                bet.amount
            } else {
                activation_threshold - amount_to_burn
            };
            
            amount_to_burn = amount_to_burn + to_burn;
            
            // Add any remaining amount to be refunded
            if bet.amount > to_burn {
                creator_remaining = creator_remaining + (bet.amount - to_burn);
            }
        } else {
            // Already reached min_activation_bet() to burn, refund rest
            creator_remaining = creator_remaining + bet.amount;
        }
    }
    
    // Burn the creator's minimum bet
    if amount_to_burn > TokenAmount::from(0u64) {
        match burn_tokens(amount_to_burn).await {
            Ok(_) => {
                ic_cdk::println!("Burned {} KONG from market creator as penalty", amount_to_burn.to_u64());
            },
            Err(e) => {
                ic_cdk::println!("Failed to burn tokens: {}", e);
                return Err(ResolutionError::VoidingFailed);
            }
        }
    }
    
    // Refund any remaining amount to the creator (above min_activation_bet())
    if creator_remaining > TokenAmount::from(0u64) && creator_remaining > KONG_TRANSFER_FEE.clone() {
        let transfer_amount = creator_remaining - KONG_TRANSFER_FEE.clone();
        
        match transfer_kong(creator, transfer_amount).await {
            Ok(_) => {
                ic_cdk::println!("Refunded {} remaining KONG to market creator", transfer_amount.to_u64());
            },
            Err(e) => {
                ic_cdk::println!("Failed to refund creator: {}", e);
                // Continue with other refunds even if this fails
            }
        }
    }
    
    // Refund all other users' bets
    for bet in other_bets {
        let transfer_amount = if bet.amount > KONG_TRANSFER_FEE.clone() {
            bet.amount - KONG_TRANSFER_FEE.clone()
        } else {
            ic_cdk::println!(
                "Skipping transfer - bet amount {} less than fee {}",
                bet.amount.to_u64(),
                KONG_TRANSFER_FEE.to_u64()
            );
            continue; // Skip if bet amount is less than transfer fee
        };
        
        ic_cdk::println!("Returning {} tokens to {}", transfer_amount.to_u64(), bet.user.to_string());
        
        if let Err(e) = transfer_kong(bet.user, transfer_amount).await {
            // If transfer fails, log it but continue with others
            ic_cdk::println!("Error refunding bet to {}: {}", bet.user.to_string(), e);
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
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });
    
    ic_cdk::println!("Market voided due to resolution disagreement");
    
    // Return appropriate error to signal disagreement
    Err(ResolutionError::ResolutionDisagreement)
}

/// Resolve the market through admin decision
/// This is a wrapper around propose_resolution for backward compatibility
#[update]
pub async fn resolve_via_admin(
    market_id: MarketId, 
    winning_outcomes: Vec<OutcomeIndex>
) -> Result<(), ResolutionError> {
    // For backwards compatibility, we'll treat this as an admin-initiated resolution proposal
    propose_resolution(market_id, winning_outcomes).await
}

/// Voids a market, refunding all bets
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
        if let Err(e) = refund_all_bets(&market).await {
            return Err(ResolutionError::VoidingFailed);
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
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });
    
    ic_cdk::println!(
        "Admin {} voided market {:?}",
        admin.to_string(),
        market_id.to_u64()
    );
    
    Ok(())
}
