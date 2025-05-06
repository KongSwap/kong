use candid::Principal;

use super::resolution::*;
use crate::canister::{get_current_time, record_market_payout};
use crate::market::bet::*;
use crate::market::market::*;
use crate::market::estimate_return_types::BetPayoutRecord;
use crate::stable_memory::*;
use crate::types::{MarketId, TokenAmount, OutcomeIndex, Timestamp, StorableNat, TokenIdentifier};
use crate::utils::time_weighting::*;
use crate::token::registry::{get_token_info, is_supported_token};
use crate::token::transfer::{transfer_token, handle_fee_transfer};
use crate::types::calculate_platform_fee;

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
    
    // Get the token information for this market
    let token_id = &market.token_id;
    let token_info = get_token_info(token_id)
        .ok_or(ResolutionError::TransferError(format!("Token info not found for ID: {}", token_id)))?;

    // Calculate total winning pool
    let total_winning_pool: StorableNat = winning_outcomes
        .iter()
        .map(|i| market.outcome_pools[i.to_u64() as usize].clone())
        .sum();

    ic_cdk::println!("Total winning pool: {}", total_winning_pool.to_u64());
    ic_cdk::println!("Total market pool: {}", market.total_pool.to_u64());
    
    // Calculate the total profit (losing bets)
    let total_profit = market.total_pool.to_u64() as u64 - total_winning_pool.to_u64();
    ic_cdk::println!("Total profit (losing bets): {}", total_profit);
    
    // Calculate platform fee based on profit (1% for KONG, 2% for others)
    let fee_percentage = token_info.fee_percentage;
    let platform_fee_amount = total_profit * fee_percentage / 10000;
    let platform_fee = TokenAmount::from(platform_fee_amount);
    
    // Calculate the remaining winning pool (for distribution)
    let remaining_pool_u64 = total_winning_pool.to_u64();
    let remaining_pool = TokenAmount::from(remaining_pool_u64);
    
    ic_cdk::println!("Platform fee ({}% of profit): {} {}", 
                    token_info.fee_percentage / 100, 
                    platform_fee.to_u64() / 10u64.pow(token_info.decimals as u32),
                    token_info.symbol);
    
    ic_cdk::println!("Winning pool for distribution: {} {}", 
                    remaining_pool.to_u64() / 10u64.pow(token_info.decimals as u32),
                    token_info.symbol);
    
    // Process the platform fee (burn for KONG, transfer to fee collector for other tokens)
    if platform_fee.to_u64() > token_info.transfer_fee.to_u64() {
        match handle_fee_transfer(platform_fee.clone(), token_id).await {
            Ok(Some(tx_id)) => {
                ic_cdk::println!("Successfully burned platform fee of {} {} (Transaction ID: {})", 
                    platform_fee.to_u64() / 10u64.pow(token_info.decimals as u32), 
                    token_info.symbol, 
                    tx_id);
            },
            Ok(None) => {
                ic_cdk::println!("Successfully burned platform fee of {} {}", 
                    platform_fee.to_u64() / 10u64.pow(token_info.decimals as u32), 
                    token_info.symbol);
            },
            Err(e) => {
                ic_cdk::println!("Error processing platform fee: {:?}. Continuing with distribution.", e);
                // Continue with distribution even if fee processing fails
            }
        }
    } else {
        ic_cdk::println!("Platform fee too small to process (less than transfer fee). Skipping fee transfer.");
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
            let mut weighted_contributions: Vec<(Principal, TokenAmount, f64, f64, OutcomeIndex)> = Vec::new();
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
                    weighted_contribution,
                    bet.outcome_index.clone()
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
            
            // Use the profit and fee values already calculated
            let total_profit_f64 = total_profit as f64;
            let platform_fee_on_profit = platform_fee.to_u64() as f64;
            
            // Calculate total transfer fees needed for all winning bets
            let transfer_fee_per_payout = token_info.transfer_fee.to_u64() as f64;
            let total_transfer_fees = (weighted_contributions.len() as f64) * transfer_fee_per_payout;
            ic_cdk::println!("Reserving {} {} for transfer fees ({} payouts)", 
                          total_transfer_fees / 10u64.pow(token_info.decimals as u32) as f64,
                          token_info.symbol,
                          weighted_contributions.len());
            
            // Calculate the distributable profit after fees
            let distributable_profit = total_profit_f64 - platform_fee_on_profit - total_transfer_fees;
            
            // Initialize bonus pool with the distributable profit
            // Note: This will potentially be adjusted by the safety check below
            
            // Guaranteed return is the original bet amount for each winner
            let total_guaranteed_return = total_winning_pool.to_u64() as f64;
            
            // SAFETY CHECK: Ensure total distribution never exceeds total market pool
            let max_distribution = market.total_pool.to_u64() as f64 - platform_fee_on_profit - total_transfer_fees;
            let mut bonus_pool = distributable_profit; // Initialize with original calculation
            
            if total_guaranteed_return + bonus_pool > max_distribution {
                ic_cdk::println!("WARNING: Distribution would exceed market pool. Adjusting bonus pool...");
                // Adjust the bonus pool to ensure we don't exceed the max distribution
                let adjusted_bonus_pool = max_distribution - total_guaranteed_return;
                if adjusted_bonus_pool < 0.0 {
                    ic_cdk::println!("ERROR: Cannot even distribute guaranteed returns. Setting bonus pool to zero.");
                    bonus_pool = 0.0;
                } else {
                    ic_cdk::println!("Adjusted bonus pool from {} to {}", bonus_pool, adjusted_bonus_pool);
                    bonus_pool = adjusted_bonus_pool;
                }
            }
            
            ic_cdk::println!(
                "Pool accounting: Total market pool: {}, Total winning pool: {}, Total profit: {}, Platform fee: {}, Transfer fees: {}, Distributable profit: {}, Bonus pool: {}, Max possible distribution: {}",
                market.total_pool.to_u64(),
                total_winning_pool.to_u64(),
                total_profit_f64,
                platform_fee_on_profit,
                total_transfer_fees,
                distributable_profit,
                bonus_pool,
                max_distribution
            );
            
            ic_cdk::println!(
                "Total winning pool: {}, Total weighted contribution: {}, Bonus pool: {}",
                total_winning_pool.to_u64(),
                total_weighted_contribution,
                bonus_pool
            );
            
            // Distribute rewards using the formula: reward_i = a_i + (c_i/C) * (P - W)
            for (user, bet_amount, weight, weighted_contribution, outcome_index) in weighted_contributions {
                // Calculate the share of the bonus pool
                let bonus_share = if total_weighted_contribution > 0.0 {
                    weighted_contribution / total_weighted_contribution * bonus_pool
                } else {
                    0.0
                };
                
                // Total reward = original bet + share of bonus pool
                // Note: Transfer fee is already accounted for in the bonus pool calculation
                let total_reward = bet_amount.to_u64() as f64 + bonus_share;
                let gross_winnings = TokenAmount::from(total_reward as u64);
                
                ic_cdk::println!(
                    "Reward breakdown for {}: Original bet: {}, Bonus share: {} ({}% of profit), Total reward: {}",
                    user.to_string(),
                    bet_amount.to_u64(),
                    bonus_share,
                    if distributable_profit > 0.0 { (bonus_share / distributable_profit) * 100.0 } else { 0.0 },
                    total_reward
                );
                
                // Calculate net amount to transfer (after deducting transfer fee)
                let transfer_amount = if gross_winnings > token_info.transfer_fee {
                    TokenAmount::from((total_reward - token_info.transfer_fee.to_u64() as f64) as u64)
                } else {
                    ic_cdk::println!(
                        "Skipping transfer - winnings {} less than fee {}",
                        gross_winnings.to_u64(),
                        token_info.transfer_fee.to_u64()
                    );
                    continue; // Skip if winnings are less than transfer fee
                };
                
                ic_cdk::println!(
                    "Processing weighted bet - User: {}, Original bet: {}, Weight: {}, Bonus share: {}, Gross reward: {}, Net transfer: {}",
                    user.to_string(),
                    bet_amount.to_u64(),
                    weight,
                    bonus_share,
                    gross_winnings.to_u64(),
                    transfer_amount.to_u64()
                );

                ic_cdk::println!("Transferring {} {} tokens to {}", 
                              transfer_amount.to_u64() / 10u64.pow(token_info.decimals as u32), 
                              token_info.symbol,
                              user.to_string());

                // Transfer winnings to the bettor using the appropriate token
                match transfer_token(user, transfer_amount.clone(), token_id, None).await {
                    Ok(tx_id) => {
                        ic_cdk::println!("Transfer successful (Transaction ID: {})", tx_id);
                        
                        // Record the payout
                        // Calculate proportional platform fee for this bet
                        let user_platform_fee = if total_reward > 0.0 && total_winning_pool.to_u64() > 0 {
                            // Calculate proportional fee based on this user's share of rewards
                            let user_share = bet_amount.to_u64() as f64 / total_winning_pool.to_u64() as f64;
                            let user_fee = platform_fee_on_profit * user_share;
                            Some(TokenAmount::from(user_fee as u64))
                        } else {
                            None
                        };
                        
                        let payout_record = BetPayoutRecord {
                            market_id: market.id.clone(),
                            user,
                            bet_amount: bet_amount.clone(),
                            payout_amount: gross_winnings.clone(), // Record the gross amount for history
                            timestamp: Timestamp::from(get_current_time()),
                            outcome_index,
                            was_time_weighted: true,
                            time_weight: Some(weight),
                            original_contribution_returned: bet_amount.clone(),
                            bonus_amount: Some(TokenAmount::from(bonus_share as u64)),
                            platform_fee_amount: user_platform_fee,
                            token_id: token_id.clone(),
                            token_symbol: token_info.symbol.clone(),
                            platform_fee_percentage: token_info.fee_percentage,
                            transaction_id: Some(tx_id),
                        };
                        
                        record_market_payout(payout_record);
                    },
                    Err(e) => {
                        ic_cdk::println!("Transfer failed: {:?}. Continuing with other payouts.", e);
                        // Continue with other payouts instead of returning an error
                    }
                }
            }
        } else {
            // Use standard (non-time-weighted) distribution
            // Calculate total bet amount from winners only
            let total_bet_amount = winning_bets.iter().map(|bet| bet.amount.to_u64()).sum::<u64>();
            
            // Calculate total transfer fees needed for all winning bets
            let transfer_fee_per_payout = token_info.transfer_fee.to_u64() as f64;
            let total_winning_bets = winning_bets.len();
            let total_transfer_fees = (total_winning_bets as f64) * transfer_fee_per_payout;
            
            ic_cdk::println!("Reserving {} {} for transfer fees ({} payouts)", 
                          total_transfer_fees / 10u64.pow(token_info.decimals as u32) as f64,
                          token_info.symbol,
                          total_winning_bets);
            
            // Adjust the remaining pool to account for transfer fees
            let remaining_pool_after_fees = if total_transfer_fees > 0.0 {
                let fees_amount = TokenAmount::from(total_transfer_fees as u64);
                if remaining_pool > fees_amount {
                    remaining_pool.clone() - fees_amount
                } else {
                    ic_cdk::println!("Warning: Transfer fees exceed remaining pool. Some payouts may fail.");
                    remaining_pool.clone()
                }
            } else {
                remaining_pool.clone()
            };
            
            if total_bet_amount > 0 {
                for bet in winning_bets {
                    // Calculate proportional winnings
                    let bet_proportion = bet.amount.to_u64() as f64 / total_bet_amount as f64;
                    
                    // Calculate user's share of the total winning pool using the adjusted pool
                    // that accounts for transfer fees
                    let user_winnings = (remaining_pool_after_fees.to_u64() as f64 * bet_proportion) as u64;
                    let gross_winnings = TokenAmount::from(user_winnings);
                    
                    // Calculate net amount to transfer (after deducting transfer fee)
                    // The transfer fee is already accounted for in the pool calculation, but we still need to
                    // subtract it from the individual payout amount for the actual transfer
                    let transfer_amount = if gross_winnings > token_info.transfer_fee.clone() {
                        gross_winnings.clone() - token_info.transfer_fee.clone()
                    } else {
                        ic_cdk::println!(
                            "Skipping transfer - winnings {} less than fee {}",
                            gross_winnings.to_u64(),
                            token_info.transfer_fee.to_u64()
                        );
                        continue; // Skip if winnings are less than transfer fee
                    };
                    
                    ic_cdk::println!(
                        "Processing bet - User: {}, Bet: {}, Share: {:.4}, Gross payout: {}, Net transfer: {}",
                        bet.user.to_string(),
                        bet.amount.to_u64(),
                        bet_proportion,
                        gross_winnings.to_u64(),
                        transfer_amount.to_u64()
                    );
                    
                    ic_cdk::println!("Transferring {} {} tokens to {}", 
                                  transfer_amount.to_u64() / 10u64.pow(token_info.decimals as u32),
                                  token_info.symbol,
                                  bet.user.to_string());
                    
                    match transfer_token(bet.user, transfer_amount.clone(), token_id, None).await {
                        Ok(tx_id) => {
                            ic_cdk::println!("Transfer successful (Transaction ID: {})", tx_id);
                            
                            // Record the payout
                            let user_platform_fee = Some(TokenAmount::from(
                                (platform_fee.to_u64() as f64 * bet_proportion) as u64
                            ));
                            
                            let payout_record = BetPayoutRecord {
                                market_id: market.id.clone(),
                                user: bet.user,
                                bet_amount: bet.amount.clone(),
                                payout_amount: gross_winnings.clone(), // Record the gross amount for history
                                timestamp: Timestamp::from(get_current_time()),
                                outcome_index: bet.outcome_index.clone(),
                                was_time_weighted: false,
                                time_weight: None,
                                original_contribution_returned: bet.amount.clone(),
                                bonus_amount: None,
                                platform_fee_amount: user_platform_fee,
                                token_id: token_id.clone(),
                                token_symbol: token_info.symbol.clone(),
                                platform_fee_percentage: token_info.fee_percentage,
                                transaction_id: Some(tx_id),
                            };
                            
                            record_market_payout(payout_record);
                        },
                        Err(e) => {
                            ic_cdk::println!("Transfer failed: {:?}. Continuing with other payouts.", e);
                            // Continue with other payouts instead of returning an error
                        }
                    }
                }
            } else {
                ic_cdk::println!("No winning bets found for this market");
            }
        }
    }

    // Update market status
    market.status = MarketStatus::Closed(winning_outcomes.into_iter().map(|x| x.inner().clone()).collect());
    Ok(())
}
