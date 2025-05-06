use candid::Principal;

use super::resolution::*;
use super::transfer_kong::*;
use crate::canister::{get_current_time, record_market_payout};
use crate::constants::PLATFORM_FEE_PERCENTAGE;
use crate::market::bet::*;
use crate::market::market::*;
use crate::market::estimate_return_types::BetPayoutRecord;
use crate::stable_memory::*;
use crate::types::{MarketId, TokenAmount, OutcomeIndex, Timestamp, StorableNat};
use crate::utils::time_weighting::*;
use crate::utils::fee_utils::{calculate_platform_fee, calculate_amount_after_fee};

lazy_static::lazy_static! {
    static ref KONG_TRANSFER_FEE: TokenAmount = TokenAmount::from(10_000u64); // 0.0001 KONG
}

/// Finalizes a market by distributing winnings to successful bettors
pub async fn finalize_market(market: &mut Market, winning_outcomes: Vec<OutcomeIndex>) -> Result<(), ResolutionError> {
    ic_cdk::println!(
        "Finalizing market {} with winning outcomes {:?}",
        market.id.to_u64(),
        winning_outcomes.iter().map(|n| n.to_u64()).collect::<Vec<_>>()
    );
    // Validate market state
    if !matches!(market.status, MarketStatus::Active) {
        return Err(ResolutionError::AlreadyResolved);
    }

    // Validate winning outcomes
    for outcome in &winning_outcomes {
        if outcome.to_u64() as usize >= market.outcomes.len() {
            return Err(ResolutionError::InvalidOutcome);
        }
    }

    // Calculate total winning pool
    let total_winning_pool: StorableNat = winning_outcomes
        .iter()
        .map(|i| market.outcome_pools[i.to_u64() as usize].clone())
        .sum();

    ic_cdk::println!("Total winning pool: {}", total_winning_pool.to_u64());
    ic_cdk::println!("Total market pool: {}", market.total_pool.to_u64());
    
    // Calculate platform fee (1% of total winning pool)
    let platform_fee = calculate_platform_fee(&TokenAmount::from(total_winning_pool.clone()));
    let remaining_pool = calculate_amount_after_fee(&TokenAmount::from(total_winning_pool.clone()));
    
    ic_cdk::println!("Platform fee ({}%): {} KONG", PLATFORM_FEE_PERCENTAGE, platform_fee.to_u64() / 1_000_000);
    ic_cdk::println!("Remaining pool for distribution (99%): {} KONG", remaining_pool.to_u64() / 1_000_000);
    
    // Burn the platform fee by transferring to minter
    if platform_fee.to_u64() > KONG_TRANSFER_FEE.to_u64() {
        match burn_tokens(platform_fee.clone()).await {
            Ok(_) => {
                ic_cdk::println!("Successfully burned platform fee of {} KONG", platform_fee.to_u64() / 1_000_000);
            },
            Err(e) => {
                ic_cdk::println!("Error burning platform fee: {}. Continuing with distribution.", e);
                // Continue with distribution even if burning fails
            }
        }
    } else {
        ic_cdk::println!("Platform fee too small to burn (less than transfer fee). Skipping burn.");
    }

    if total_winning_pool > 0u64 {
        // Get all winning bets
        let winning_bets = BETS.with(|bets| {
            let bets = bets.borrow();
            if let Some(bet_store) = bets.get(&market.id) {
                bet_store
                    .0
                    .iter()
                    .filter(|bet| winning_outcomes.iter().any(|x| x == &bet.outcome_index))
                    .cloned()
                    .collect::<Vec<_>>()
            } else {
                Vec::new()
            }
        });

        ic_cdk::println!("Found {} winning bets", winning_bets.len());

        // Check if this market uses time weighting
        if market.uses_time_weighting {
            // Use time-weighted distribution
            let market_created_at = market.created_at.clone();
            let market_end_time = market.end_time.clone();
            let alpha = get_market_alpha(market);
            
            ic_cdk::println!("Using time-weighted distribution with alpha: {}", alpha);
            
            // Calculate weighted contributions for each winning bet
            let mut weighted_contributions: Vec<(Principal, TokenAmount, f64, f64)> = Vec::new();
            let mut total_weighted_contribution: f64 = 0.0;
            
            for bet in &winning_bets {
                let bet_amount = bet.amount.to_f64();
                
                // Calculate time-based weight
                let weight = calculate_time_weight(
                    market_created_at.clone(),
                    market_end_time.clone(),
                    bet.timestamp.clone(),
                    alpha
                );
                
                let weighted_contribution = calculate_weighted_contribution(bet_amount, weight);
                weighted_contributions.push((
                    bet.user, 
                    bet.amount.clone(), 
                    weight, 
                    weighted_contribution
                ));
                total_weighted_contribution += weighted_contribution;
                
                ic_cdk::println!(
                    "Bet by {} at time {}, weight: {}, weighted contribution: {}",
                    bet.user.to_string(), 
                    bet.timestamp.to_u64(),
                    weight,
                    weighted_contribution
                );
            }
            
            // Use the remaining pool (99%) after platform fee deduction
            let remaining_pool_f64 = remaining_pool.to_u64() as f64;
            
            // Total guaranteed return = sum of all winning bet amounts
            let total_guaranteed_return = total_winning_pool.to_u64() as f64;
            
            // Calculate the adjusted guaranteed return (99% of original)
            let adjusted_guaranteed_return = remaining_pool_f64 * (total_guaranteed_return / total_winning_pool.to_u64() as f64);
            
            // Bonus pool = remaining pool (99% of total) minus adjusted guaranteed returns
            let bonus_pool = market.total_pool.to_u64() as f64 * 0.99 - adjusted_guaranteed_return;
            
            ic_cdk::println!(
                "Total winning pool: {}, Total weighted contribution: {}, Bonus pool: {}",
                total_winning_pool.to_u64(),
                total_weighted_contribution,
                bonus_pool
            );
            
            // Distribute rewards using the formula: reward_i = a_i + (c_i/C) * (P - W)
            for (user, bet_amount, weight, weighted_contribution) in weighted_contributions {
                // Calculate the share of the bonus pool
                let bonus_share = if total_weighted_contribution > 0.0 {
                    weighted_contribution / total_weighted_contribution * bonus_pool
                } else {
                    0.0
                };
                
                // Total reward = original bet + share of bonus pool
                let total_reward = bet_amount.to_u64() as f64 + bonus_share;
                let winnings = TokenAmount::from(total_reward as u64);
                
                ic_cdk::println!(
                    "Processing weighted bet - User: {}, Original bet: {}, Weight: {}, Bonus share: {}, Total reward: {}",
                    user.to_string(),
                    bet_amount.to_u64(),
                    weight,
                    bonus_share,
                    winnings.to_u64()
                );

                // Account for transfer fee
                let transfer_amount = if winnings > KONG_TRANSFER_FEE.clone() {
                    winnings - KONG_TRANSFER_FEE.clone()
                } else {
                    ic_cdk::println!(
                        "Skipping transfer - winnings {} less than fee {}",
                        winnings.to_u64(),
                        KONG_TRANSFER_FEE.to_u64()
                    );
                    continue; // Skip if winnings are less than transfer fee
                };

                ic_cdk::println!("Transferring {} tokens to {}", transfer_amount.to_u64(), user.to_string());

                // Transfer winnings to the bettor
                match transfer_kong(user, transfer_amount.clone()).await {
                    Ok(_) => {
                        ic_cdk::println!("Transfer successful");
                        
                        // Record the payout
                        // Calculate proportional platform fee for this bet
                        let user_platform_fee = if total_reward > 0.0 {
                            // Calculate proportional fee based on this user's share of rewards
                            let user_share = total_reward / remaining_pool_f64;
                            let user_fee = platform_fee.to_u64() as f64 * user_share;
                            Some(TokenAmount::from(user_fee as u64))
                        } else {
                            None
                        };
                        
                        let payout_record = BetPayoutRecord {
                            market_id: market.id.clone(),
                            user,
                            bet_amount: bet_amount.clone(),
                            payout_amount: transfer_amount.clone(),
                            timestamp: Timestamp::from(get_current_time()),
                            outcome_index: OutcomeIndex::from(0u64), // We don't have this info here, using 0 as default
                            was_time_weighted: true,
                            time_weight: Some(weight),
                            original_contribution_returned: bet_amount.clone(),
                            bonus_amount: Some(TokenAmount::from(bonus_share as u64)),
                            platform_fee_amount: user_platform_fee,
                        };
                        
                        record_market_payout(payout_record);
                    },
                    Err(e) => {
                        ic_cdk::println!("Transfer failed: {}", e);
                        return Err(ResolutionError::TransferError(e));
                    }
                }
            }
        } else {
            // Original distribution logic for non-time-weighted markets, adjusted for platform fee
            ic_cdk::println!("Using original distribution method (no time weighting) with 1% platform fee");
            
            // Use the remaining pool (99%) after platform fee deduction
            let remaining_pool_f64 = remaining_pool.to_u64() as f64;
            
            for bet in winning_bets {
                let share = bet.amount.to_f64() / total_winning_pool.to_f64();
                // Calculate winnings based on 99% of the total pool
                let winnings = TokenAmount::from((remaining_pool_f64 * share) as u64);

                ic_cdk::println!(
                    "Processing winning bet - User: {}, Original bet: {}, Share: {}, Raw winnings: {}",
                    bet.user.to_string(),
                    bet.amount.to_u64(),
                    share,
                    winnings.to_u64()
                );

                // Account for transfer fee
                let transfer_amount = if winnings.clone() > KONG_TRANSFER_FEE.clone() {
                    winnings.clone() - KONG_TRANSFER_FEE.clone()
                } else {
                    ic_cdk::println!(
                        "Skipping transfer - winnings {} less than fee {}",
                        winnings.to_u64(),
                        KONG_TRANSFER_FEE.to_u64()
                    );
                    continue; // Skip if winnings are less than transfer fee
                };

                ic_cdk::println!("Transferring {} tokens to {}", transfer_amount.to_u64(), bet.user.to_string());

                // Transfer winnings to the bettor
                match transfer_kong(bet.user, transfer_amount.clone()).await {
                    Ok(_) => {
                        ic_cdk::println!("Transfer successful");
                        
                        // Record the payout
                        // Calculate proportional platform fee for this bet
                        let user_platform_fee = if winnings.to_u64() > 0 {
                            // Calculate proportional fee based on this user's share of rewards
                            let user_share = winnings.to_u64() as f64 / remaining_pool_f64;
                            let user_fee = platform_fee.to_u64() as f64 * user_share;
                            Some(TokenAmount::from(user_fee as u64))
                        } else {
                            None
                        };
                        
                        let payout_record = BetPayoutRecord {
                            market_id: market.id.clone(),
                            user: bet.user,
                            bet_amount: bet.amount.clone(),
                            payout_amount: transfer_amount.clone(),
                            timestamp: Timestamp::from(get_current_time()),
                            outcome_index: bet.outcome_index.clone(),
                            was_time_weighted: false,
                            time_weight: None,
                            original_contribution_returned: bet.amount.clone(),
                            bonus_amount: None,
                            platform_fee_amount: user_platform_fee,
                        };
                        
                        record_market_payout(payout_record);
                    },
                    Err(e) => {
                        ic_cdk::println!("Transfer failed: {}", e);
                        return Err(ResolutionError::TransferError(e));
                    }
                }
            }
        }
    }

    // Update market status
    market.status = MarketStatus::Closed(winning_outcomes.into_iter().map(|x| x.inner().clone()).collect());
    Ok(())
}
