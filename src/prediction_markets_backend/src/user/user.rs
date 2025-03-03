use candid::CandidType;
use serde::Deserialize;

use crate::market::market::*;
use crate::nat::*;

#[derive(CandidType, Deserialize)]
pub struct UserBetInfo {
    pub market: Market,
    pub bet_amount: StorableNat,
    pub outcome_index: StorableNat,
    pub outcome_text: String,
    pub winnings: Option<StorableNat>, // None if market not resolved, Some(0) if lost, Some(amount) if won
}

#[derive(CandidType, Deserialize)]
pub struct UserHistory {
    pub active_bets: Vec<UserBetInfo>,        // Bets in markets that are still open
    pub pending_resolution: Vec<UserBetInfo>, // Bets in markets that are expired but not resolved
    pub resolved_bets: Vec<UserBetInfo>,      // Bets in markets that are resolved
    pub total_wagered: StorableNat,
    pub total_won: StorableNat,
    pub current_balance: StorableNat,
}
