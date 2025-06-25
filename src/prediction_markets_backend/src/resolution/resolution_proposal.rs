//! # Resolution Proposal Management
//!
//! This module manages the creation, validation, and processing of
//! market resolution proposals for the dual approval system.

use super::finalize_market::finalize_market;
use super::resolution::*;
use crate::controllers::admin::is_admin;
use crate::get_current_time;
use crate::market::market::*;
use crate::resolution::resolution_refunds::create_dispute_refund_claims;
use crate::storage::*;
use crate::types::*;

pub async fn propose_resolution(args: ResolutionArgs) -> ResolutionResult {
    let market_id = args.market_id;
    let winning_outcomes = args.winning_outcomes;
    
    let caller = ic_cdk::caller();

    // Validate authorization: Only market creator or admin can propose resolution
    let is_caller_admin = is_admin(caller);

    // Get the market
    let mut market = match MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id)
    }) {
        Some(market) => market,
        None => return ResolutionResult::Error(ResolutionError::MarketNotFound),
    };

    // Check if caller is the market creator
    let is_caller_creator = market.creator == caller;

    // Verify authorization (must be either market creator or admin)
    if !is_caller_admin && !is_caller_creator {
        return ResolutionResult::Error(ResolutionError::Unauthorized);
    }

    // Ensure each outcome index is valid for this market
    for outcome_index in &winning_outcomes {
        let idx = outcome_index.to_u64() as usize;
        if idx >= market.outcomes.len() {
            return ResolutionResult::Error(ResolutionError::InvalidOutcome);
        }
    }

    // Fast path for admin-created markets: Admin can directly resolve without dual approval
    let is_admin_market = is_admin(market.creator);

    if is_admin_market && is_caller_admin {
        // Skip the dual approval process for admin-created markets
        ic_cdk::println!("Admin resolving admin-created market directly");

        // Finalize the market in one step when admin resolves an admin-created market
        match finalize_market(&mut market, winning_outcomes.clone()).await {
            Ok(_) => {
                // Update market status to Closed with winning outcomes
                market.status = MarketStatus::Closed(winning_outcomes.iter().map(|idx| idx.inner().clone()).collect());
                market.resolved_by = Some(caller);

                // CRITICAL FIX: Persist market with updated status
                MARKETS.with(|markets| {
                    let mut markets_ref = markets.borrow_mut();
                    markets_ref.insert(market_id.clone(), market);
                });

                ic_cdk::println!("Admin-created market {} successfully resolved", market_id.to_u64());
                return ResolutionResult::Success;
            }
            Err(e) => return ResolutionResult::Error(e),
        }
    }

    // DUAL APPROVAL FLOW FOR USER-CREATED MARKETS

    // Check if a proposal already exists for this market
    let existing_proposal = RESOLUTION_PROPOSALS.with(|proposals| {
        // Use clone() on the Option instead of cloned() which is for iterators
        proposals.borrow().get(&market_id).clone()
    });

    // Handle dual approval based on whether a proposal already exists
    let _ = match existing_proposal {
        // First resolution step: No proposal exists yet, so create one
        None => {
            use crate::resolution::resolution::{ResolutionVote, VoterType};
            
            let current_time = get_current_time();
            
            // Create the vote for whoever is proposing first
            let vote = ResolutionVote {
                voter: caller,
                proposed_outcomes: winning_outcomes.clone(),
                voted_at: current_time.clone(),
                voter_type: if is_caller_creator { VoterType::Creator } else { VoterType::Admin },
            };
            
            // Create a new resolution proposal with the first vote
            let proposal = ResolutionProposal {
                market_id: market_id.clone(),
                creator_vote: if is_caller_creator { Some(vote.clone()) } else { None },
                admin_vote: if is_caller_admin { Some(vote) } else { None },
                creator: market.creator,
                proposed_at: current_time,
                // Legacy fields for backward compatibility
                #[allow(deprecated)]
                proposed_outcomes: winning_outcomes.clone(),
                #[allow(deprecated)]
                creator_approved: is_caller_creator,
                #[allow(deprecated)]
                admin_approved: is_caller_admin,
                #[allow(deprecated)]
                admin_approver: if is_caller_admin { Some(caller) } else { None },
            };

            // Store the proposal in stable memory so it persists across canister upgrades
            RESOLUTION_PROPOSALS.with(|proposals| {
                let mut proposals = proposals.borrow_mut();
                proposals.insert(market_id.clone(), proposal.clone());
            });

            // Provide appropriate feedback based on who initiated the proposal
            if is_caller_creator {
                ic_cdk::println!("Market creator proposed resolution, waiting for admin confirmation");
                ResolutionResult::AwaitingAdminApproval
            } else {
                ic_cdk::println!("Admin proposed resolution, waiting for creator confirmation");
                ResolutionResult::AwaitingCreatorApproval
            }
        }
        // Second resolution step: Proposal exists, now checking for agreement/disagreement
        Some(mut proposal) => {
            use crate::resolution::resolution::{ResolutionVote, VoterType};
            
            // Check who has already voted
            let creator_already_voted = proposal.creator_vote.is_some();
            let admin_already_voted = proposal.admin_vote.is_some();

            // DUAL APPROVAL SCENARIO 1: Creator proposed first, now admin reviewing
            if creator_already_voted && is_caller_admin && !admin_already_voted {
                ic_cdk::println!("Admin reviewing creator's resolution proposal");

                // Create admin vote
                let admin_vote = ResolutionVote {
                    voter: caller,
                    proposed_outcomes: winning_outcomes.clone(),
                    voted_at: get_current_time(),
                    voter_type: VoterType::Admin,
                };
                
                // Add admin vote to proposal
                proposal.admin_vote = Some(admin_vote);
                
                // Update legacy fields for backward compatibility
                #[allow(deprecated)]
                {
                    proposal.admin_approved = true;
                    proposal.admin_approver = Some(caller);
                }

                // Save updated proposal with admin vote to storage
                RESOLUTION_PROPOSALS.with(|proposals| {
                    let mut proposals_ref = proposals.borrow_mut();
                    proposals_ref.insert(market_id.clone(), proposal.clone());
                });

                // Check if admin's outcomes match creator's proposed outcomes
                let creator_outcomes = proposal.creator_vote.as_ref().unwrap().proposed_outcomes.clone();
                if creator_outcomes == winning_outcomes {
                    // AGREEMENT: Both creator and admin agree on outcomes
                    ic_cdk::println!("Admin confirms creator's resolution outcomes. Finalizing market.");

                    // Remove proposal since we're processing it
                    RESOLUTION_PROPOSALS.with(|proposals| {
                        let mut proposals = proposals.borrow_mut();
                        proposals.remove(&market_id);
                    });

                    // Finalize the market with the agreed outcomes
                    match finalize_market(&mut market, winning_outcomes.clone()).await {
                        Ok(_) => {
                            // CRITICAL FIX: Update market status to Closed with winning outcomes
                            market.status = MarketStatus::Closed(winning_outcomes.iter().map(|idx| idx.inner().clone()).collect());
                            market.resolved_by = Some(caller);

                            // CRITICAL FIX: Persist updated market in storage
                            MARKETS.with(|markets| {
                                let mut markets_ref = markets.borrow_mut();
                                markets_ref.insert(market_id.clone(), market);
                            });

                            ic_cdk::println!("Market {} successfully finalized and persisted", market_id.to_u64());
                            return ResolutionResult::Success;
                        }
                        Err(e) => return ResolutionResult::Error(e),
                    }
                } else {
                    // DISAGREEMENT: Admin disagrees with creator's proposed outcomes
                    ic_cdk::println!("Admin disagrees with creator's resolution. Voiding market.");

                    // In case of disagreement, void the market and burn creator's deposit
                    // as a penalty for incorrect resolution
                    match handle_resolution_disagreement(market_id, market, proposal).await {
                        Ok(_) => return ResolutionResult::Success,
                        Err(e) => return ResolutionResult::Error(e),
                    }
                }
            }
            // DUAL APPROVAL SCENARIO 2: Admin proposed first, now creator reviewing
            else if admin_already_voted && is_caller_creator && !creator_already_voted {
                ic_cdk::println!("Creator reviewing admin's resolution proposal");

                // Create creator vote
                let creator_vote = ResolutionVote {
                    voter: caller,
                    proposed_outcomes: winning_outcomes.clone(),
                    voted_at: get_current_time(),
                    voter_type: VoterType::Creator,
                };
                
                // Add creator vote to proposal
                proposal.creator_vote = Some(creator_vote);
                
                // Update legacy fields for backward compatibility
                #[allow(deprecated)]
                {
                    proposal.creator_approved = true;
                }

                // Save updated proposal with creator vote to storage
                RESOLUTION_PROPOSALS.with(|proposals| {
                    let mut proposals_ref = proposals.borrow_mut();
                    proposals_ref.insert(market_id.clone(), proposal.clone());
                });

                // Check if creator's outcomes match admin's proposed outcomes
                let admin_outcomes = proposal.admin_vote.as_ref().unwrap().proposed_outcomes.clone();
                if admin_outcomes == winning_outcomes {
                    // AGREEMENT: Both admin and creator agree on outcomes
                    ic_cdk::println!("Creator confirms admin's resolution outcomes. Finalizing market.");

                    // Remove proposal since we're processing it
                    RESOLUTION_PROPOSALS.with(|proposals| {
                        let mut proposals = proposals.borrow_mut();
                        proposals.remove(&market_id);
                    });

                    // Finalize the market with the agreed outcomes
                    match finalize_market(&mut market, winning_outcomes.clone()).await {
                        Ok(_) => {
                            // CRITICAL FIX: Update market status to Closed with winning outcomes
                            market.status = MarketStatus::Closed(winning_outcomes.iter().map(|idx| idx.inner().clone()).collect());
                            market.resolved_by = Some(proposal.admin_approver.unwrap_or(caller));

                            // CRITICAL FIX: Persist updated market in storage
                            MARKETS.with(|markets| {
                                let mut markets_ref = markets.borrow_mut();
                                markets_ref.insert(market_id.clone(), market);
                            });

                            ic_cdk::println!("Market {} successfully finalized and persisted", market_id.to_u64());
                            return ResolutionResult::Success;
                        }
                        Err(e) => return ResolutionResult::Error(e),
                    }
                } else {
                    // DISAGREEMENT: Creator disagrees with admin's proposed outcomes
                    ic_cdk::println!("Creator disagrees with admin's resolution. Voiding market.");

                    // If the creator disagrees with the admin's proposed resolution,
                    // the market is voided - just like when an admin disagrees with a creator
                    match handle_resolution_disagreement(market_id, market, proposal).await {
                        Ok(_) => return ResolutionResult::Success,
                        Err(e) => return ResolutionResult::Error(e),
                    }
                }
            }
            // EDGE CASE: Caller is attempting to re-submit an already submitted proposal
            else if (is_caller_creator && creator_already_voted) || (is_caller_admin && admin_already_voted) {
                // Caller is attempting to submit a proposal they already made
                if is_caller_creator {
                    ic_cdk::println!("Creator has already proposed a resolution, waiting for admin approval");
                    ResolutionResult::AwaitingAdminApproval
                } else {
                    ic_cdk::println!("Admin has already proposed a resolution, waiting for creator approval");
                    ResolutionResult::AwaitingCreatorApproval
                }
            } else {
                // This should not happen given the logic above, but handle it gracefully
                return ResolutionResult::Error(ResolutionError::Unauthorized);
            }
        }
    };

    // Return the appropriate waiting state (should be unreachable due to early returns above)
    if is_caller_creator {
        ResolutionResult::AwaitingAdminApproval
    } else {
        ResolutionResult::AwaitingCreatorApproval
    }
}

// This function handles the case where there's a disagreement between
// market creator and admin on resolution outcomes
async fn handle_resolution_disagreement(
    market_id: MarketId,
    mut market: Market,
    proposal: ResolutionProposal,
) -> Result<(), ResolutionError> {
    // Log the disagreement details
    ic_cdk::println!(
        "Resolution disagreement for market {}. Voiding market and burning creator's deposit.",
        market_id.to_u64()
    );

    // Process refunds for all bets AND burn the creator's deposit
    // This creates claims for all bettors to withdraw their funds,
    // except for the creator's activation deposit which gets burned
    if let Err(e) = create_dispute_refund_claims(&market_id, &market).await {
        return Err(e);
    }

    // Update market status to Voided
    market.status = MarketStatus::Voided;

    // Record disagreement details
    market.resolution_data = Some(format!(
        "Voided due to resolution disagreement. Creator proposed {:?}, Admin proposed different outcomes.",
        proposal.proposed_outcomes.iter().map(|n| n.to_u64()).collect::<Vec<_>>()
    ));

    // Store the updated market in stable storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id.clone(), market);
    });

    // Remove the resolution proposal since it's been processed
    RESOLUTION_PROPOSALS.with(|proposals| {
        let mut proposals = proposals.borrow_mut();
        proposals.remove(&market_id);
    });

    Ok(())
}
