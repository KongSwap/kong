//! # Market Finalization Module
//!
//! This module handles the finalization of prediction markets, including the distribution of
//! winnings to successful bettors. It represents the culmination of the prediction market
//! lifecycle, transforming user bets into payouts based on market outcomes.
//!
//! ## Distribution Models
//!
//! The system supports two distinct payout distribution approaches:
//!
//! ### 1. Standard Distribution
//!
//! All winning bettors receive proportional payouts based solely on their bet amounts,
//! regardless of when they placed their bets. The formula is straightforward:
//!
//! ```
//! payout_i = bet_i + (bet_i / total_winning_bets) * profit_pool
//! ```
//!
//! Where:
//! - `payout_i` is the total payout to user i
//! - `bet_i` is the user's original bet amount
//! - `total_winning_bets` is the sum of all bets on winning outcomes
//! - `profit_pool` is the total amount bet on losing outcomes minus fees
//!
//! ### 2. Time-Weighted Distribution
//!
//! This innovative model rewards users who committed to predictions earlier by applying an
//! exponential weighting function to bet timing. Earlier bettors receive higher rewards,
//! creating incentives for early market participation and price discovery.
//!
//! #### Mathematical Model
//!
//! The time-weighted payout is calculated as:
//!
//! ```
//! reward_i = bet_i + (weighted_contribution_i / total_weighted_contribution) * bonus_pool
//! ```
//!
//! Where:
//! - `weighted_contribution_i = bet_i * weight_i`
//! - `weight_i = α^(t/T)` (exponential decay function)
//! - `α` is the time decay parameter (default 0.1)
//! - `t` is the time elapsed since market creation when the bet was placed
//! - `T` is the total market duration
//! - `bonus_pool` is the distributable profit (losing bets minus fees)
//!
//! #### Economic Benefits
//!
//! The time-weighted model provides several advantages:
//!
//! - **Early Risk Taking**: Rewards users who take positions when uncertainty is highest
//! - **Improved Price Discovery**: Incentivizes early market participation
//! - **Return Floor Guarantee**: All winning bettors receive at least their original bet back
//! - **Predictable Advantage Curve**: With α = 0.1, early bets receive up to 10x the weight
//!
//! This implementation includes comprehensive safeguards to ensure rewards never exceed
//! the total market pool, with dynamic bonus pool adjustments if necessary.

use num_traits::ToPrimitive;

use super::resolution::*;
use crate::bet::bet::Bet;
use crate::canister::{get_current_time, record_market_payout};
use crate::claims::claims_processing::create_winning_claim;
use crate::market::estimate_return_types::BetPayoutRecord;
use crate::market::market::*;
use crate::storage::BETS;
use crate::token::registry::get_token_info;
use crate::token::transfer::{get_fee_account, handle_fee_transfer, handle_fee_transfer_failure};
use crate::utils::time_weighting::{calculate_time_weight, calculate_weighted_contribution, get_market_alpha};

// Import re-exported types from lib.rs
use crate::types::BetDistributionDetail;
use crate::types::FailedTransactionInfo;
use crate::types::MarketResolutionDetails;
use crate::types::StorableNat;
use crate::OutcomeIndex;
use crate::Timestamp;
use crate::TokenAmount;

/// Structure to track failed transaction information within the finalization process
///
/// When a token transfer fails during market finalization, this structure stores
// Note: FailedTransactionInfo is now imported from crate::types

/// Finalizes a market by creating claims for successful bettors
///
/// This function handles the complete market resolution process including:
/// 1. Validating the market state and winning outcomes
/// 2. Calculating the total winning pool and platform fees
/// 3. Processing the platform fee (burn or transfer)
/// 4. Creating claims for winning bettors to claim their winnings using either:
///    - Standard proportional distribution, or
///    - Time-weighted distribution (if market.uses_time_weighting is true)
/// 5. Recording payout information for each winning bet
///
/// For time-weighted markets, earlier bets receive higher payouts based on an
/// exponential weighting model. This rewards users who committed to their
/// predictions earlier, while ensuring all correct predictors receive at least
/// their original bet amount back.
///
/// # Parameters
/// * `market` - Mutable reference to the market being finalized
/// * `winning_outcomes` - Vector of outcome indices that won
///
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error reason if finalization fails
pub async fn finalize_market(market: &mut Market, winning_outcomes: Vec<OutcomeIndex>) -> Result<(), ResolutionError> {
    ic_cdk::println!(
        "Finalizing market {} with winning outcomes {:?}",
        market.id.to_u64(),
        winning_outcomes.iter().map(|n| n.to_u64()).collect::<Vec<_>>()
    );

    // Initialize market resolution details structure to capture all resolution information
    let current_time = get_current_time();
    let mut resolution_details = MarketResolutionDetails {
        market_id: market.id.clone(),
        winning_outcomes: winning_outcomes.clone(),
        resolution_timestamp: current_time,
        total_market_pool: market.total_pool.clone(),
        total_winning_pool: TokenAmount::from(0),  // Will update later
        total_profit: TokenAmount::from(0),        // Will update later
        platform_fee_amount: TokenAmount::from(0), // Will update later
        platform_fee_percentage: 0,                // Will update later
        fee_transaction_id: None,
        token_id: market.token_id.clone(),
        token_symbol: String::new(), // Will update later
        winning_bet_count: 0,        // Will update later
        used_time_weighting: market.uses_time_weighting,
        time_weight_alpha: market.time_weight_alpha,
        // total_transfer_fees: TokenAmount::default(),  // Will update if applicable
        distributable_profit: TokenAmount::from(0), // Will update if applicable
        total_weighted_contribution: None,          // Will update if time-weighted
        distribution_details: Vec::new(),
        failed_transactions: Vec::new(),
    };

    // Validate market state - allow both Active and ExpiredUnresolved markets to be finalized
    if !matches!(market.status, MarketStatus::Active | MarketStatus::ExpiredUnresolved) {
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
    let token_info =
        get_token_info(token_id).ok_or(ResolutionError::TransferError(format!("Token info not found for ID: {}", token_id)))?;

    // Update token symbol in resolution details
    resolution_details.token_symbol = token_info.symbol.clone();
    resolution_details.platform_fee_percentage = token_info.fee_percentage;

    // Calculate total winning pool
    let total_winning_pool: StorableNat = winning_outcomes
        .iter()
        .map(|i| market.outcome_pools[i.to_u64() as usize].clone())
        .sum();

    // Update resolution details with pool information
    resolution_details.total_winning_pool = total_winning_pool.clone();

    ic_cdk::println!("Total winning pool: {}", total_winning_pool);
    ic_cdk::println!("Total market pool: {}", market.total_pool);

    // Calculate the total profit (losing bets)
    let total_profit = market.total_pool.clone() - total_winning_pool.clone();
    resolution_details.total_profit = total_profit.clone();

    ic_cdk::println!("Total profit (losing bets): {}", total_profit);

    // Calculate platform fee based on profit (1% for KONG, 2% for others)
    let fee_percentage = token_info.fee_percentage;
    let platform_fee = total_profit.clone() * fee_percentage / 10000;

    // Update platform fee in resolution details
    resolution_details.platform_fee_amount = platform_fee.clone();

    // Calculate the remaining winning pool (for distribution)
    let remaining_pool = TokenAmount::from(total_winning_pool.clone());

    ic_cdk::println!(
        "Platform fee ({}% of profit): {} {}",
        token_info.fee_percentage / 100,
        platform_fee.to_f64() / 10f64.powf(token_info.decimals as f64),
        token_info.symbol
    );

    ic_cdk::println!(
        "Winning pool for distribution: {} {}",
        remaining_pool.to_f64() / 10f64.powf(token_info.decimals as f64),
        token_info.symbol
    );

    // Process the platform fee (burn for KONG, transfer to fee collector for other tokens)
    if platform_fee > token_info.transfer_fee {
        match handle_fee_transfer(platform_fee.clone(), token_id).await {
            Ok(Some(tx_id)) => {
                // Store transaction ID in resolution details
                // Convert Nat to u64 for storage in our resolution details
                resolution_details.fee_transaction_id = Some(tx_id.0.to_u64().unwrap());

                ic_cdk::println!(
                    "Successfully burned platform fee of {} {} (Transaction ID: {})",
                    platform_fee.to_f64() / 10f64.powf(token_info.decimals as f64),
                    token_info.symbol,
                    tx_id
                );
            }
            Ok(None) => {
                ic_cdk::println!(
                    "Successfully burned platform fee of {} {}",
                    platform_fee.to_f64() / 10f64.powf(token_info.decimals as f64),
                    token_info.symbol
                );
            }
            Err(e) => {
                // Record fee transfer error in resolution details
                let error_msg = format!("{:?}", e);
                // Create failure record for platform fee transfer
                // Add failed transaction to resolution details with the updated structure
                resolution_details.failed_transactions.push(FailedTransactionInfo {
                    market_id: Some(market.id.clone()),
                    user: get_fee_account(token_info.is_kong),
                    amount: platform_fee.clone(),
                    token_id: Some(token_id.clone()),
                    error: error_msg.clone(),
                    timestamp: Some(get_current_time()),
                });

                handle_fee_transfer_failure(market.id.clone(), platform_fee.clone(), &token_info, e);

                ic_cdk::println!("Error processing platform fee: {}. Continuing with distribution.", error_msg);
                // Continue with distribution even if fee processing fails
            }
        }
    } else {
        ic_cdk::println!("Platform fee too small to process (less than transfer fee). Skipping fee transfer.");
    }

    // Get all winning bets
    let (winning_bets, lost_bets): (Vec<_>, Vec<_>) = BETS.with(|_bets| {
        // Get all bets for this market using our helper function
        crate::storage::get_bets_for_market(&market.id)
            .into_iter()
            .partition(|bet| winning_outcomes.iter().any(|x| x == &bet.outcome_index))
    });

    if total_winning_pool > 0u64 {
        // Store the count for reporting at the end of the function
        resolution_details.winning_bet_count = winning_bets.len() as u64;
        ic_cdk::println!("Found {} winning bets", winning_bets.len());

        // Time-Weighted Distribution Model
        //
        // When a market is configured to use time-weighted distribution (market.uses_time_weighting = true),
        // the system applies an exponential weighting model that rewards earlier betting behavior.
        // This model is designed to incentivize early market participation and improve price discovery.
        if market.uses_time_weighting {
            // The time-weighted distribution uses a sophisticated exponential decay function
            // that calculates weights based on when bets were placed relative to market duration.
            //
            // The time weight formula is: weight = α^(t/T) where:
            // - α is the decay parameter (typically 0.1, configurable per market)
            // - t is the time elapsed since market creation when the bet was placed
            // - T is the total market duration from creation to closing
            //
            // With α = 0.1, this creates a powerful incentive structure:
            // - Bets placed at market start receive full weight (1.0)
            // - Bets placed at market midpoint receive weight of ~0.32
            // - Bets placed at market end receive minimum weight (0.1)
            let market_created_at = market.created_at.clone();
            let market_end_time = market.end_time.clone();
            let alpha = get_market_alpha(market);

            // Update resolution details for time-weighted distribution
            resolution_details.time_weight_alpha = Some(alpha);

            ic_cdk::println!("Using time-weighted distribution with alpha: {}", alpha);

            // Calculate weighted contributions for each winning bet
            // Each bet's contribution is weighted by time - earlier bets get higher weights
            // The tuple contains: (&bet, time_weight, weighted_contribution)
            let mut weighted_contributions: Vec<(&Bet, f64, f64)> = Vec::new();
            let mut total_weighted_contribution: f64 = 0.0;

            for bet in &winning_bets {
                let bet_amount = bet.amount.to_f64();

                // Calculate time-based exponential weight
                //
                // This applies the core time-weighting function that determines how much
                // additional reward a particular bet receives based on its timing.
                //
                // The weight ranges from 1.0 (bet placed at market creation) to α (bet placed at market end)
                let weight = calculate_time_weight(
                    market_created_at.clone(), // When the market was created
                    market_end_time.clone(),   // When the market closes for betting
                    bet.timestamp.clone(),     // When this particular bet was placed
                    alpha,                     // The exponential decay parameter
                );

                // The weighted contribution combines bet amount with time weight
                // This value represents the bet's share of the bonus pool
                // Formula: weighted_contribution = bet_amount * weight
                let weighted_contribution = calculate_weighted_contribution(bet_amount, weight);
                weighted_contributions.push((&bet, weight, weighted_contribution));
                total_weighted_contribution += weighted_contribution;

                // Add distribution detail to resolution details
                resolution_details.distribution_details.push(BetDistributionDetail {
                    user: bet.user,
                    bet_amount: bet.amount.clone(),
                    time_weight: Some(weight),
                    weighted_contribution: Some(weighted_contribution),
                    bonus_amount: TokenAmount::from(0), // Will update after bonus calculation
                    total_payout: TokenAmount::from(0), // Will update after bonus calculation
                    outcome_index: bet.outcome_index.clone(),
                    claim_id: None, // Will update after claim creation
                });

                ic_cdk::println!(
                    "Bet by {} at time {}, weight: {}, weighted contribution: {}",
                    bet.user.to_string(),
                    bet.timestamp.to_u64(),
                    weight,
                    weighted_contribution
                );
            }

            // Store total weighted contribution in resolution details
            resolution_details.total_weighted_contribution = Some(total_weighted_contribution);

            // Use the profit and fee values already calculated
            let total_profit_f64 = total_profit.clone().to_f64();
            let platform_fee_on_profit = platform_fee.to_f64();

            // Calculate the distributable profit after fees
            let distributable_profit = total_profit_f64 - platform_fee_on_profit;

            // Update resolution details with distributable profit
            resolution_details.distributable_profit = TokenAmount::from(distributable_profit as u64);

            // Initialize bonus pool with the distributable profit
            // Note: This will potentially be adjusted by the safety check below

            // Guaranteed return is the original bet amount for each winner
            let total_guaranteed_return = total_winning_pool.to_f64();

            // Financial Safety System: Guaranteed Return Floor with Maximum Cap
            //
            // This critical financial safety mechanism ensures two important guarantees:
            // 1. All winning bettors receive at least their original bet back (return floor)
            // 2. Total distributions never exceed the available market pool (maximum cap)
            //
            // The system dynamically adjusts the bonus pool if necessary to maintain these guarantees.
            let max_distribution = market.total_pool.to_f64() - platform_fee_on_profit;
            let mut bonus_pool = distributable_profit; // Initialize with original calculation

            // Safety check: Verify that total distribution won't exceed total market pool
            // This could happen in edge cases with extreme time-weighting parameters
            if total_guaranteed_return + bonus_pool > max_distribution {
                ic_cdk::println!("WARNING: Distribution would exceed market pool. Adjusting bonus pool...");

                // Dynamically adjust the bonus pool to ensure we don't exceed the max distribution
                // Formula: adjusted_bonus_pool = max_distribution - total_guaranteed_return
                let adjusted_bonus_pool = max_distribution - total_guaranteed_return;

                if adjusted_bonus_pool < 0.0 {
                    // Extreme edge case: Cannot even guarantee return of original bets
                    // This should never happen with proper validation, but we handle it safely
                    ic_cdk::println!("ERROR: Cannot even distribute guaranteed returns. Setting bonus pool to zero.");
                    bonus_pool = 0.0;
                } else {
                    // Normal adjustment: Reduce bonus pool to safe level
                    ic_cdk::println!("Adjusted bonus pool from {} to {}", bonus_pool, adjusted_bonus_pool);
                    bonus_pool = adjusted_bonus_pool;
                }
            }

            ic_cdk::println!(
                "Pool accounting: Total market pool: {}, Total winning pool: {}, Total profit: {}, Platform fee: {}, Distributable profit: {}, Bonus pool: {}, Max possible distribution: {}",
                market.total_pool.to_u64(),
                total_winning_pool.to_u64(),
                total_profit_f64,
                platform_fee_on_profit,
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

            // Time-Weighted Reward Distribution System
            //
            // This core distribution algorithm implements the time-weighted reward model using the formula:
            // reward_i = original_bet_i + (weighted_contribution_i / total_weighted_contribution) * bonus_pool
            //
            // This formula guarantees two important properties:
            // 1. Return Floor: All winners receive at least their original bet amount back
            // 2. Time Advantage: Earlier bettors receive a larger share of the bonus pool
            //
            // The system distributes the bonus pool (profits from losing bets) proportionally
            // to each bet's weighted contribution, which combines bet amount and time weight.
            // Bets placed earlier have higher weights, resulting in higher proportional rewards.
            let mut detail_index = 0;

            for (bet, weight, weighted_contribution) in weighted_contributions {
                let bet_amount = bet.amount.clone();
                let user = bet.user;
                let outcome_index = bet.outcome_index.clone();

                // Calculate the share of the bonus pool
                let bonus_share = if total_weighted_contribution > 0.0 {
                    weighted_contribution / total_weighted_contribution * bonus_pool
                } else {
                    0.0
                };

                // Total reward = original bet + share of bonus pool
                // Note: Transfer fee is already accounted for in the bonus pool calculation
                let total_reward = bet_amount.to_f64() + bonus_share;
                let gross_winnings = TokenAmount::from(total_reward as u64);

                // Update resolution details with bonus and final payout amounts
                if detail_index < resolution_details.distribution_details.len() {
                    let bonus_amount = TokenAmount::from(bonus_share as u64);
                    resolution_details.distribution_details[detail_index].bonus_amount = bonus_amount;
                    resolution_details.distribution_details[detail_index].total_payout = gross_winnings.clone();
                }
                detail_index += 1;

                ic_cdk::println!(
                    "Reward breakdown for {}: Original bet: {}, Bonus share: {} ({}% of profit), Total reward: {}",
                    user.to_string(),
                    bet_amount.to_u64(),
                    bonus_share,
                    if distributable_profit > 0.0 {
                        (bonus_share / distributable_profit) * 100.0
                    } else {
                        0.0
                    },
                    total_reward
                );

                // Calculate user's platform fee (proportional to their reward)
                let user_platform_fee = if total_reward > 0.0 && total_winning_pool.to_u64() > 0 {
                    // Calculate proportional fee based on this user's share of rewards
                    let user_share = bet_amount.to_f64() / total_winning_pool.to_f64();
                    let user_fee = platform_fee_on_profit * user_share;
                    Some(TokenAmount::from(user_fee as u64))
                } else {
                    None
                };

                // Update user statistics
                crate::user::user_betting_summary::on_finished_market_bet(&bet, Some(gross_winnings.clone()));

                // Skip if winnings are less than transfer fee
                if gross_winnings <= token_info.transfer_fee {
                    ic_cdk::println!(
                        "Skipping claim - winnings {} less than fee {}",
                        gross_winnings.to_u64(),
                        token_info.transfer_fee.to_u64()
                    );
                    continue;
                }

                ic_cdk::println!(
                    "Processing weighted bet - User: {}, Original bet: {}, Weight: {}, Bonus share: {}, Gross reward: {}",
                    user.to_string(),
                    bet_amount.to_u64(),
                    weight,
                    bonus_share,
                    gross_winnings.to_u64()
                );

                ic_cdk::println!(
                    "Creating claim for {} {} tokens to {}",
                    gross_winnings.to_u64() / 10u64.pow(token_info.decimals as u32),
                    token_info.symbol,
                    user.to_string()
                );

                // Create a claim for the user instead of transferring tokens directly
                let claim_id = create_winning_claim(
                    user,
                    market.id.clone(),
                    bet_amount.clone(),
                    vec![outcome_index.clone()],
                    gross_winnings.clone(),
                    user_platform_fee.clone(), // This is already an Option<TokenAmount>
                    token_id.clone(),
                    Timestamp::from(get_current_time()),
                );

                // Update resolution details with claim ID
                // Find the distribution detail for this user and outcome
                for detail in &mut resolution_details.distribution_details {
                    if detail.user == user && detail.outcome_index == outcome_index {
                        detail.claim_id = Some(claim_id);
                        break;
                    }
                }

                ic_cdk::println!(
                    "Created claim {} for user {} with amount {}",
                    claim_id,
                    user.to_string(),
                    gross_winnings.to_u64()
                );

                let payout_record = BetPayoutRecord {
                    market_id: market.id.clone(),
                    user,
                    bet_amount: bet_amount.clone(),
                    payout_amount: gross_winnings.clone(),
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
                    transaction_id: None, // No transaction yet, user will claim
                };

                record_market_payout(payout_record);
            }
        } else {
            // Use standard (non-time-weighted) distribution
            //
            // In the standard distribution model, winnings are distributed proportionally
            // to bet amounts without considering when the bets were placed. Each winner
            // receives a share of the total pool proportional to their bet amount:
            //
            // reward_i = (bet_amount_i / total_bet_amount) * remaining_pool
            //
            // This simpler model provides consistent proportional returns regardless of
            // bet timing. It's more straightforward for users to understand and predict
            // their potential returns.

            // Calculate total bet amount from winners only
            let total_bet_amount = winning_bets.iter().map(|bet| bet.amount.to_u64()).sum::<u64>();

            // Calculate total transfer fees taken
            let total_fees = platform_fee.clone();

            // Adjust the remaining pool to account for transfer fees
            // This preemptively reserves all needed transfer fees from the winning pool,
            // ensuring that every winner can be paid even after accounting for fees.
            let total_profit_after_fees = if total_fees > StorableNat::from_u64(0) {
                if total_profit > total_fees {
                    total_profit.clone() - total_fees
                } else {
                    // Safety check: if transfer fees would exceed the entire pool,
                    // warn but proceed with distribution. Some transfers may fail,
                    // but the transaction recovery system will handle retries.
                    ic_cdk::println!("Warning: Transfer fees exceed remaining pool. Some payouts may fail.");
                    total_profit.clone()
                }
            } else {
                total_profit.clone()
            };

            resolution_details.distributable_profit = total_profit_after_fees.clone();

            if total_bet_amount > 0 {
                for bet in winning_bets {
                    // Calculate proportional winnings based on the user's bet amount
                    // Proportion = user_bet_amount / total_winning_bets_amount
                    // This proportion determines the user's share of the total prize pool
                    let bet_proportion = bet.amount.to_f64() / total_bet_amount as f64;

                    // Calculate user's share of the total winning pool using the adjusted pool
                    // that accounts for transfer fees. The formula is:
                    // user_winnings = (total_pool_after_fees * bet_amount) / total_bet_amount
                    //
                    // This ensures fair distribution proportional to each user's contribution
                    // while accounting for necessary platform fees and transfer costs.
                    let user_winnings = bet.amount.to_u64() + (total_profit_after_fees.to_f64() * bet_proportion) as u64;
                    let gross_winnings = TokenAmount::from(user_winnings);

                    // Update user statistics
                    crate::user::user_betting_summary::on_finished_market_bet(&bet, Some(gross_winnings.clone()));

                    // Calculate net amount to transfer (after deducting transfer fee)
                    // The transfer fee is already accounted for in the pool calculation, but we still need to
                    // subtract it from the individual payout amount for the actual transfer.
                    // This separation of concerns (pool adjustment + individual transfer fee) ensures
                    // transparency in the accounting and accurate payouts.
                    if gross_winnings <= token_info.transfer_fee.clone() {
                        ic_cdk::println!(
                            "Skipping transfer - winnings {} less than fee {}",
                            gross_winnings.to_u64(),
                            token_info.transfer_fee.to_u64()
                        );
                        continue; // Skip if winnings are less than transfer fee
                    }

                    ic_cdk::println!(
                        "Processing bet - User: {}, Bet: {}, Share: {:.4}, Gross transfer: {}",
                        bet.user.to_string(),
                        bet.amount.to_u64(),
                        bet_proportion,
                        gross_winnings.to_u64(),
                    );

                    ic_cdk::println!(
                        "Creating claim for {} {} tokens to {}",
                        gross_winnings.to_u64() / 10u64.pow(token_info.decimals as u32),
                        token_info.symbol,
                        bet.user.to_string()
                    );

                    // Create a claim for the user instead of transferring tokens directly
                    let claim_id = create_winning_claim(
                        bet.user,
                        market.id.clone(),
                        bet.amount.clone(),
                        vec![bet.outcome_index.clone()],
                        gross_winnings.clone(),
                        Some(TokenAmount::from((platform_fee.to_u64() as f64 * bet_proportion) as u64)),
                        market.token_id.clone(),
                        Timestamp::from(get_current_time()),
                    );

                    ic_cdk::println!(
                        "Created claim {} for user {} with amount {}",
                        claim_id,
                        bet.user.to_string(),
                        gross_winnings.to_u64()
                    );

                    // Record the payout in the bet history
                    let payout_record = BetPayoutRecord {
                        market_id: market.id.clone(),
                        user: bet.user,
                        bet_amount: bet.amount.clone(),
                        payout_amount: gross_winnings.clone(),
                        timestamp: Timestamp::from(get_current_time()),
                        outcome_index: bet.outcome_index.clone(),
                        was_time_weighted: false,
                        time_weight: None,
                        original_contribution_returned: bet.amount.clone(),
                        bonus_amount: None,
                        platform_fee_amount: Some(TokenAmount::from((platform_fee.to_u64() as f64 * bet_proportion) as u64)),
                        token_id: token_id.clone(),
                        token_symbol: token_info.symbol.clone(),
                        platform_fee_percentage: token_info.fee_percentage,
                        transaction_id: None, // No transaction yet, user will claim
                    };

                    record_market_payout(payout_record);
                }
            }
        }
    }

    for bet in lost_bets {
        crate::user::user_betting_summary::on_finished_market_bet(&bet, None);
    }

    // Update market status to Closed with the winning outcomes
    // This finalizes the market in the stable memory system and prevents
    // any further bets or resolutions on this market
    market.status = MarketStatus::Closed(winning_outcomes.into_iter().map(|x| x.inner().clone()).collect());

    // Store resolution details in the thread-local storage
    crate::storage::MARKET_RESOLUTION_DETAILS.with(|details| {
        details.borrow_mut().insert(market.id.clone(), resolution_details.clone());
    });

    ic_cdk::println!(
        "Market {} successfully finalized with {} winning bets paid out",
        market.id.to_u64(),
        resolution_details.winning_bet_count
    );

    ic_cdk::println!("Market {} successfully finalized and persisted", market.id.to_u64());

    Ok(())
}
