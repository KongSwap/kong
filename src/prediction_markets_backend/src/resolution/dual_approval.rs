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

/// Determines if a user can resolve a market
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

/// Proposes resolution for a market (implements dual-approval for user-created markets)
/// For admin-created markets, admin resolution is direct without dual approval
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
    let is_market_creator_admin = is_admin(market.creator);
    
    // Check authorization - only creator or admin can propose resolutions
    // Use the can_resolve_market function to ensure proper authorization
    if !can_resolve_market(&market, caller) {
        return Err(ResolutionError::Unauthorized);
    }
    
    // Special case: For admin-created markets, any admin can resolve directly without dual approval
    if is_market_creator_admin && is_caller_admin {
        ic_cdk::println!(
            "Admin {} directly resolving admin-created market {}",
            caller.to_string(),
            market_id.to_u64()
        );
        
        // Finalize the market directly - skip the dual approval process
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
    
    // Check existing proposals or create a new one
    let result = RESOLUTION_PROPOSALS.with(|proposals| {
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
                    // Return the data needed for disagreement handling
                    return Ok((true, market_id.clone(), market.clone(), proposal.clone()));
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
                // Return the data needed for finalization
                // We'll handle the finalization outside this closure
                return Ok((false, market_id.clone(), market.clone(), proposal.clone()));
            } else {
                // Store proposal approval status before moving it
                let creator_approved = proposal.creator_approved;
                let admin_approved = proposal.admin_approved;
                
                // Update proposal
                proposals.insert(market_id.clone(), proposal);
                
                // Inform if waiting for the other party
                if creator_approved && !admin_approved {
                    return Err(ResolutionError::AwaitingAdminApproval);
                } else if !creator_approved && admin_approved {
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
            
            // Store proposal
            proposals.insert(market_id.clone(), proposal.clone());
            
            // Inform about waiting for the other party
            if is_caller_creator {
                return Err(ResolutionError::AwaitingAdminApproval);
            } else {
                return Err(ResolutionError::AwaitingCreatorApproval);
            }
        }
        
        // Return a default value that won't be used
        // This is needed because all code paths above return early
        // We never actually reach this code path
        Ok((false, market_id.clone(), market.clone(), ResolutionProposal {
            market_id: market_id.clone(),
            proposed_outcomes: winning_outcomes.clone(),
            creator_approved: false,
            admin_approved: false,
            creator: market.creator,
            admin_approver: None,
            proposed_at: get_current_time(),
        }))
    });
    
    // Process the result from the closure
    match result {
        Ok((is_disagreement, market_id_clone, mut market_clone, proposal_clone)) => {
            if is_disagreement {
                // Handle disagreement outside the closure
                return handle_resolution_disagreement(market_id_clone, market_clone, proposal_clone).await;
            } else {
                // We have dual approval, finalize the market
                finalize_market(&mut market_clone, winning_outcomes.clone()).await?;
                
                // Update market status
                market_clone.status = MarketStatus::Closed(winning_outcomes.iter().map(|idx| Nat::from(idx.clone())).collect());
                market_clone.resolved_by = proposal_clone.admin_approver;
                
                // Update market in storage
                MARKETS.with(|markets| {
                    let mut markets_ref = markets.borrow_mut();
                    markets_ref.insert(market_id_clone.clone(), market_clone);
                });
                
                // Remove proposal
                RESOLUTION_PROPOSALS.with(|proposals| {
                    let mut proposals = proposals.borrow_mut();
                    proposals.remove(&market_id_clone);
                });
                
                ic_cdk::println!(
                    "Market {:?} resolved with dual approval",
                    market_id_clone.to_u64()
                );
                
                return Ok(());
            }
        },
        Err(e) => return Err(e),
    };
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
/// For admin-created markets: immediate resolution by any admin
/// For user-created markets: requires dual approval between creator and admin
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
