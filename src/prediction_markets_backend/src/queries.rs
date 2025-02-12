use candid::Principal;
use ic_cdk::query;
use crate::*;

/// Gets a specific market by its ID with detailed betting statistics
#[query]
pub fn get_market(market_id: MarketId) -> Option<Market> {
    MARKETS.with(|markets| {
        markets.borrow().get(&market_id).map(|market| {
            let mut market = market.clone();
            
            // Calculate outcome pools and bet counts
            let mut outcome_pools = vec![0u64; market.outcomes.len()];
            let mut bet_counts = vec![StorableNat::from(0u64); market.outcomes.len()];
            let mut total_bets = StorableNat::from(0u64);
            
            BETS.with(|bets| {
                if let Some(bet_store) = bets.borrow().get(&market_id) {
                    for bet in bet_store.0.iter() {
                        let outcome_idx = bet.outcome_index.to_u64() as usize;
                        outcome_pools[outcome_idx] = (StorableNat::from(outcome_pools[outcome_idx]) + bet.amount.clone()).to_u64();
                        bet_counts[outcome_idx] = bet_counts[outcome_idx].clone() + StorableNat::from_u64(1);
                        total_bets = total_bets.clone() + StorableNat::from_u64(1);
                    }
                }
            });
            
            // Calculate percentages
            let outcome_pools_clone = outcome_pools.clone();
            market.outcome_pools = outcome_pools.into_iter().map(|x| StorableNat::from(x)).collect();
            market.outcome_percentages = outcome_pools_clone.iter()
                .map(|&amount| if !market.total_pool.is_zero() {
                    ((amount as f64) / (market.total_pool.to_u64() as f64)) * 100.0
                } else {
                    0.0
                })
                .collect();
            market.bet_counts = bet_counts.clone();
            
            market.bet_count_percentages = bet_counts.iter()
                .map(|count| if total_bets > StorableNat::from(0u64) {
                    count.to_f64() / total_bets.to_f64() * 100.0
                } else {
                    0.0
                })
                .collect();
            
            // Clear rules as they're not relevant in this context
            market.rules = String::new();
            
            market
        })
    })
}

/// Gets all markets with detailed betting statistics
#[query]
pub fn get_all_markets() -> Vec<Market> {
    MARKETS.with(|markets| {
        markets
            .borrow()
            .iter()
            .map(|(market_id, market)| {
                let mut market = market.clone();
                
                // Calculate outcome pools and bet counts
                let mut outcome_pools = vec![0u64; market.outcomes.len()];
                let mut bet_counts = vec![StorableNat::from(0u64); market.outcomes.len()];
                let mut total_bets = StorableNat::from(0u64);
                
                BETS.with(|bets| {
                    if let Some(bet_store) = bets.borrow().get(&market_id) {
                        for bet in bet_store.0.iter() {
                            let outcome_idx = bet.outcome_index.to_u64() as usize;
                            let new_amount = StorableNat::from(outcome_pools[outcome_idx]) + bet.amount.clone();
                            outcome_pools[outcome_idx] = new_amount.0.0.to_u64().unwrap_or(0);
                            bet_counts[outcome_idx] = bet_counts[outcome_idx].clone() + StorableNat::from_u64(1);
                            total_bets = total_bets.clone() + StorableNat::from_u64(1);
                        }
                    }
                });
                
                // Calculate percentages
                let outcome_pools_clone = outcome_pools.clone();
                market.outcome_pools = outcome_pools.into_iter().map(|x| StorableNat::from(x)).collect();
                market.outcome_percentages = outcome_pools_clone.iter()
                    .map(|&amount| if !market.total_pool.is_zero() {
                        ((amount as f64) / (market.total_pool.to_u64() as f64)) * 100.0
                    } else {
                        0.0
                    })
                    .collect();
                market.bet_counts = bet_counts.clone();
                
                market.bet_count_percentages = bet_counts.iter()
                    .map(|count| if !total_bets.is_zero() {
                        count.to_f64() / total_bets.to_f64() * 100.0
                    } else {
                        0.0
                    })
                    .collect();
                
                // Clear rules as they're not relevant in this context
                market.rules = String::new();
                
                market
            })
            .collect()
    })
}

/// Gets all bets for a specific market
#[query]
pub fn get_market_bets(market_id: MarketId) -> Vec<Bet> {
    BETS.with(|bets| {
        bets.borrow()
            .get(&market_id)
            .map(|bet_store| bet_store.0)
            .unwrap_or_default()
    })
}

/// Gets the user's KONG balance REMOVE BEFORE PRODUCTION
#[query]
pub async fn get_balance(user: Principal) -> StorableNat {
    let args = Account { owner: user };
    let ledger = Principal::from_text(KONG_LEDGER_ID)
        .expect("Invalid ledger ID");

    match call::call::<_, (candid::Nat,)>(ledger, "icrc1_balance_of", (args,)).await {
        Ok((balance,)) => StorableNat::from(balance.0.to_u64().unwrap_or(0)),
        Err(_) => StorableNat::from(0u64),
    }
}

/// Get markets grouped by their status: active, expired but unresolved, and resolved
#[query]
pub fn get_markets_by_status() -> MarketsByStatus {
    let current_time = ic_cdk::api::time();
    
    MARKETS.with(|markets| {
        let markets = markets.borrow();
        let mut result = MarketsByStatus {
            active: Vec::new(),
            expired_unresolved: Vec::new(),
            resolved: Vec::new(),
        };

        for (market_id, market) in markets.iter() {
            match market.status {
                MarketStatus::Open => {
                    // Get bet distribution for the market
                    let mut outcome_pools = vec![StorableNat::from(0u64); market.outcomes.len()];
                    BETS.with(|bets| {
                        if let Some(bet_store) = bets.borrow().get(&market_id) {
                            for bet in bet_store.0.iter() {
                                let outcome_idx = bet.outcome_index.to_u64() as usize;
                                outcome_pools[outcome_idx] = outcome_pools[outcome_idx].clone() + bet.amount.clone();
                            }
                        }
                    });
                    
                    // Create a modified market with outcome pool information
                    let mut market = market.clone();
                    market.rules = String::new(); // Remove rules as they're not relevant in this context
                    
                    if StorableNat::from(current_time) < market.end_time {
                        result.active.push(market);
                    } else {
                        result.expired_unresolved.push(market);
                    }
                }
                MarketStatus::Disputed => {
                    // Add disputed markets to expired_unresolved since they need admin attention
                    let mut market = market.clone();
                    market.rules = String::new(); // Remove rules as they're not relevant in this context
                    result.expired_unresolved.push(market);
                }
                MarketStatus::Closed(ref winning_outcomes) => {
                    // Calculate distributions for resolved markets
                    let mut distributions = Vec::new();
                    let mut total_winning_pool = StorableNat::from(0u64);
                    let mut outcome_pools = vec![StorableNat::from(0u64); market.outcomes.len()];
                    let mut bet_counts = vec![StorableNat::from(0u64); market.outcomes.len()];
                    let mut total_bets = StorableNat::from(0u64);
                    
                    BETS.with(|bets| {
                        if let Some(bet_store) = bets.borrow().get(&market_id) {
                            for bet in bet_store.0.iter() {
                                let outcome_idx = bet.outcome_index.to_u64() as usize;
                                outcome_pools[outcome_idx] = outcome_pools[outcome_idx].clone() + bet.amount.clone();
                                bet_counts[outcome_idx] = bet_counts[outcome_idx].clone() + StorableNat::from_u64(1);
                                total_bets = total_bets.clone() + StorableNat::from_u64(1);
                                
                                if winning_outcomes.iter().any(|n| candid::Nat::from(bet.outcome_index.clone()) == *n) {
                                    total_winning_pool = total_winning_pool.clone() + bet.amount.clone();
                                    distributions.push(Distribution {
                                        user: bet.user,
                                        outcome_index: bet.outcome_index.clone(),
                                        bet_amount: bet.amount.clone(),
                                        winnings: bet.amount.clone(),  // Placeholder, actual winnings calculated below
                                    });
                                }
                            }
                        }
                    });
                    
                    // Calculate actual winnings for each distribution
                    if !total_winning_pool.is_zero() {
                        for dist in distributions.iter_mut() {
                            dist.winnings = (dist.bet_amount.clone() * market.total_pool.clone()) / total_winning_pool.clone().to_u64();
                        }
                    }
                    
                    // Calculate percentages
                    let outcome_pools_clone = outcome_pools.clone();
                    let outcome_percentages = outcome_pools_clone.iter()
                        .map(|amount| if !market.total_pool.is_zero() {
                            amount.to_f64() / market.total_pool.to_f64() * 100.0
                        } else {
                            0.0
                        })
                        .collect();
                    
                    let bet_count_percentages = bet_counts.iter()
                        .map(|count| if !total_bets.is_zero() {
                            count.to_f64() / total_bets.to_f64() * 100.0
                        } else {
                            0.0
                        })
                        .collect();
                    
                    let mut market = market.clone();
                    market.rules = String::new(); // Remove rules as they're not relevant in this context
                    
                    result.resolved.push(MarketResult {
                        market: market.clone(),
                        winning_outcomes: winning_outcomes.iter().map(|n| StorableNat::from(n.0.to_u64().unwrap_or(0))).collect(),
                        total_pool: market.total_pool.clone(),
                        winning_pool: total_winning_pool,
                        outcome_pools,
                        outcome_percentages,
                        bet_counts,
                        bet_count_percentages,
                        distributions,
                    });
                }
            }
        }
        
        result
    })
}

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
                            total_wagered = total_wagered.clone() + bet.amount.clone();
                            
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
                                    if winning_outcomes.iter().any(|n| candid::Nat::from(bet.outcome_index.clone()) == *n) {
                                        // Calculate winnings based on the proportion of the winning pool
                                        let mut total_winning_pool = StorableNat::from(0u64);
                                        for other_bet in bet_store.0.iter() {
                                            if winning_outcomes.iter().any(|n| candid::Nat::from(other_bet.outcome_index.clone()) == *n) {
                                                total_winning_pool = total_winning_pool + other_bet.amount.clone();
                                            }
                                        }
                                        
                                        let winnings = if !total_winning_pool.is_zero() {
                                            (bet.amount.clone() * market.total_pool.clone()) / total_winning_pool.to_u64()
                                        } else {
                                            StorableNat::from(0u64)
                                        };
                                        
                                        total_winnings = total_winnings.clone() + winnings.clone();
                                    }
                                    
                                    resolved_bets.push(UserBetInfo {
                                        market: market.clone(),
                                        bet_amount: bet.amount.clone(),
                                        outcome_index: bet.outcome_index.clone(),
                                        outcome_text: market.outcomes[bet.outcome_index.to_u64() as usize].clone(),
                                        winnings: Some(StorableNat::from(0u64)),
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

/// Gets the accumulated fee balance and admin principal
#[query]
pub fn get_fee_balance() -> GetFeeBalanceResult {
    GetFeeBalanceResult {
        balance: FEE_BALANCE.with(|balance| StorableNat::from(balance.borrow().get(&get_admin_principal()).unwrap_or_default())),
        admin_principal: get_admin_principal(),
    }
}