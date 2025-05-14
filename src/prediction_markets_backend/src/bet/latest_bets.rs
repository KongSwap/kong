use ic_cdk::query;
use super::bet::*;

/// Gets the latest 50 bets 
#[query]
pub fn get_latest_bets() -> Vec<Bet> {
    let mut bets = BETS.with(|bets| bets.borrow().values().flat_map(|bet_store| bet_store.0.iter()).collect()); 
    bets.sort_by_key(|bet| bet.bet_time);
    bets.reverse();
    bets.truncate(50);
    bets
}
