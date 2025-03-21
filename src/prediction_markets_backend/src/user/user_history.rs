use candid::Principal;
use ic_cdk::query;

use super::user::*;

use crate::market::market::*;
use crate::nat::*;
use crate::stable_memory::*;

/// Get betting history for a specific user
#[query]
pub fn get_user_history(user: Principal) -> UserHistory {
    let mut active_bets = Vec::new();
    let mut resolved_bets = Vec::new();
    let mut total_wagered = StorableNat::from(0u64);
    let mut total_winnings = StorableNat::from(0u64);
    let mut total_active = StorableNat::from(0u64);

    MARKETS.with(|markets| {
        let markets = markets.borrow();

        BETS.with(|bets| {
            let bets = bets.borrow();

            for (market_id, bet_store) in bets.iter() {
                if let Some(market) = markets.get(&market_id) {
                    for bet in bet_store.0.iter() {
                        if bet.user == user {
                            total_wagered += bet.amount.clone();

                            match market.status {
                                MarketStatus::Open => {
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
                                        // Calculate winnings based on the proportion of the winning pool
                                        let mut total_winning_pool = StorableNat::from(0u64);
                                        for other_bet in bet_store.0.iter() {
                                            if winning_outcomes
                                                .iter()
                                                .any(|n| candid::Nat::from(other_bet.outcome_index.clone()) == *n)
                                            {
                                                total_winning_pool += other_bet.amount.clone();
                                            }
                                        }

                                        winnings = if !total_winning_pool.is_zero() {
                                            (bet.amount.clone() * market.total_pool.clone()) / total_winning_pool.to_u64()
                                        } else {
                                            StorableNat::from(0u64)
                                        };

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
