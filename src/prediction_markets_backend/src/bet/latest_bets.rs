use serde::{Serialize};
use candid::{CandidType, Deserialize};
use ic_cdk::query;
use super::bet::*;
use crate::market::market::Market;
use crate::stable_memory::{STABLE_MARKETS, STABLE_BETS};


#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct LatestBets {
    pub bet: Bet,
    pub market: Market,
}

/// Gets the latest 50 bets 
#[query]
pub fn get_latest_bets() -> Vec<LatestBets> {
    let mut bets = STABLE_BETS.with(|bets| {
        bets.borrow()
            .iter()
            .map(|(_, bet)| bet.clone())
            .collect::<Vec<_>>()
    });
    bets.sort_by_key(|bet| bet.timestamp.clone());  
    bets.reverse();
    bets.truncate(50);

    let latest_bets = bets.iter().map(|bet| {
        let market = STABLE_MARKETS.with(|markets| markets.borrow().get(&bet.market_id).unwrap());
        LatestBets {
            bet: bet.clone().to_owned(),
            market: market.clone(),
        }
    }).collect();

    latest_bets
}
