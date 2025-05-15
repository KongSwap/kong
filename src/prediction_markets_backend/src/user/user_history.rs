use candid::Principal;
use ic_cdk::query;
use std::collections::HashMap;

use super::user::*;

use crate::market::market::*;
use crate::utils::time_weighting::*;
use crate::types::{TokenAmount, StorableNat, Timestamp};
use crate::storage::{MARKETS, BETS, get_bets_for_market};

/// Get betting history for a specific user
#[query]
pub fn get_user_history(user: Principal) -> UserHistory {
    let mut active_bets = Vec::new();
    let mut resolved_bets = Vec::new();
    let mut total_wagered = TokenAmount::from(0u64);
    let mut total_winnings = TokenAmount::from(0u64);
    let mut total_active = TokenAmount::from(0u64);

    MARKETS.with(|markets| {
        let markets = markets.borrow();

        BETS.with(|bets| {
            let bets = bets.borrow();
            
            // Group bets by market_id
            let mut market_bets: HashMap<StorableNat, Vec<_>> = HashMap::new();
            
            // Collect all bets for this user, organizing them by market_id using the new BetKey type
            for (bet_key, bet) in bets.iter() {
                if bet.user == user {
                    market_bets.entry(bet_key.market_id.clone()).or_default().push(bet.clone());
                }
            }
            
            // Process each market's bets
            for (market_id, user_bets) in market_bets.iter() {
                if let Some(market) = markets.get(market_id) {
                    // Collect all bets for this market for payout calculations
                    let all_market_bets = get_bets_for_market(market_id);
                    
                    // Process each bet for this market and user
                    for bet in user_bets {
                        total_wagered += bet.amount.clone();

                        match &market.status {
                            MarketStatus::Active | MarketStatus::PendingActivation | MarketStatus::ExpiredUnresolved => {
                                total_active = total_active.clone() + bet.amount.clone();
                                active_bets.push(UserBetInfo {
                                    market: market.clone(),
                                    bet_amount: bet.amount.clone(),
                                    outcome_index: bet.outcome_index.clone(),
                                    outcome_text: market.outcomes[bet.outcome_index.to_u64() as usize].clone(),
                                    winnings: Some(StorableNat::from(0u64)),
                                });
                            }
                            MarketStatus::Closed(ref winning_outcomes) => {
                                // Initialize winnings to zero by default
                                let mut winnings = StorableNat::from(0u64);
                                
                                if winning_outcomes.iter().any(|n| candid::Nat::from(bet.outcome_index.clone()) == *n) {
                                    // Check if this is a time-weighted market
                                    if market.uses_time_weighting {
                                        // For time-weighted markets, calculate using time-weighted formula
                                        let market_created_at = market.created_at.to_u64() as f64;
                                        let market_end_time = market.end_time.to_u64() as f64;
                                        let alpha = get_market_alpha(&market);
                                        
                                        // Calculate time-based weight for this bet
                                        // Weight is used for other bets in the market pool, but not directly in this calculation
                                        let _bet_weight = calculate_time_weight(
                                            Timestamp::from(market_created_at as u64),
                                            Timestamp::from(market_end_time as u64),
                                            bet.timestamp.clone(),
                                            alpha
                                        );
                                        
                                        // Calculate total winning pool and weighted contributions
                                        let mut total_winning_pool = StorableNat::from(0u64);
                                        let mut weighted_contributions: Vec<(Principal, StorableNat, f64, f64)> = Vec::new();
                                        let mut total_weighted_contribution: f64 = 0.0;
                                        
                                        for other_bet in &all_market_bets {
                                            if winning_outcomes
                                                .iter()
                                                .any(|n| candid::Nat::from(other_bet.outcome_index.clone()) == *n)
                                            {
                                                total_winning_pool += other_bet.amount.clone();
                                                
                                                // Calculate weight for this winning bet
                                                let other_weight = calculate_time_weight(
                                                    Timestamp::from(market_created_at as u64),
                                                    Timestamp::from(market_end_time as u64),
                                                    other_bet.timestamp.clone(),
                                                    alpha
                                                );
                                                
                                                let weighted_contribution = calculate_weighted_contribution(
                                                    other_bet.amount.to_f64(),
                                                    other_weight
                                                );
                                                
                                                weighted_contributions.push((
                                                    other_bet.user.clone(),
                                                    other_bet.amount.clone(),
                                                    other_weight,
                                                    weighted_contribution
                                                ));
                                                
                                                total_weighted_contribution += weighted_contribution;
                                            }
                                        }
                                        
                                        // Find this user's bet in the weighted contributions
                                        for (contrib_user, bet_amount, _weight, weighted_contribution) in weighted_contributions {
                                            if contrib_user == bet.user && bet_amount == bet.amount {
                                                // Calculate bonus pool
                                                let bonus_pool = market.total_pool.to_u64() as f64 - total_winning_pool.to_u64() as f64;
                                                
                                                // Calculate bonus share
                                                let bonus_share = if total_weighted_contribution > 0.0 {
                                                    weighted_contribution / total_weighted_contribution * bonus_pool
                                                } else {
                                                    0.0
                                                };
                                                
                                                // Total reward = original bet + share of bonus pool
                                                let total_reward = bet_amount.to_u64() as f64 + bonus_share;
                                                winnings = StorableNat::from(total_reward as u64);
                                                break;
                                            }
                                        }
                                    } else {
                                        // For standard markets, calculate winnings based on the proportion of the winning pool
                                        let mut total_winning_pool = StorableNat::from(0u64);
                                        for other_bet in &all_market_bets {
                                            if winning_outcomes
                                                .iter()
                                                .any(|n| candid::Nat::from(other_bet.outcome_index.clone()) == *n)
                                            {
                                                total_winning_pool += other_bet.amount.clone();
                                            }
                                        }

                                        winnings = if !total_winning_pool.is_zero() {
                                            (bet.amount.clone() * market.total_pool.clone()) / total_winning_pool.clone().into()
                                        } else {
                                            StorableNat::from(0u64)
                                        };
                                    }
                                    
                                    total_winnings += winnings.clone();
                                }

                                resolved_bets.push(UserBetInfo {
                                    market: market.clone(),
                                    bet_amount: bet.amount.clone(),
                                    outcome_index: bet.outcome_index.clone(),
                                    outcome_text: market.outcomes[bet.outcome_index.to_u64() as usize].clone(),
                                    winnings: Some(winnings),
                                });
                            }
                            MarketStatus::Disputed => {
                                total_active = total_active.clone() + bet.amount.clone();
                                active_bets.push(UserBetInfo {
                                    market: market.clone(),
                                    bet_amount: bet.amount.clone(),
                                    outcome_index: bet.outcome_index.clone(),
                                    outcome_text: market.outcomes[bet.outcome_index.to_u64() as usize].clone(),
                                    winnings: Some(StorableNat::from(0u64)),
                                });
                            },
                            MarketStatus::Voided => {
                                // For voided markets, add to resolved bets with original bet amount as winnings
                                // since all bets are returned to users
                                resolved_bets.push(UserBetInfo {
                                    market: market.clone(),
                                    bet_amount: bet.amount.clone(),
                                    outcome_index: bet.outcome_index.clone(),
                                    outcome_text: market.outcomes[bet.outcome_index.to_u64() as usize].clone(),
                                    winnings: Some(bet.amount.clone()),
                                });
                            }
                        }
                    }
                }
            }
        });
    });

    UserHistory {
        active_bets,
        pending_resolution: Vec::new(), // Add empty pending resolution list
        resolved_bets,
        total_wagered,
        total_won: total_winnings,
        current_balance: total_active,
    }
}
