use std::collections::HashMap;

use candid::CandidType;
use serde::Deserialize;

use crate::market::market::*;
use crate::token::registry::TokenIdentifier;
use crate::types::{TokenAmount, OutcomeIndex};

#[derive(CandidType, Deserialize)]
pub struct UserBetInfo {
    pub market: Market,
    pub bet_amount: TokenAmount,
    pub outcome_index: OutcomeIndex,
    pub outcome_text: String,
    pub winnings: Option<TokenAmount>, // None if market not resolved, Some(0) if lost, Some(amount) if won
}

#[derive(CandidType, Deserialize)]
pub struct UserHistory {
    pub active_bets: Vec<UserBetInfo>,        // Bets in markets that are still open
    pub pending_resolution: Vec<UserBetInfo>, // Bets in markets that are expired but not resolved
    pub resolved_bets: Vec<UserBetInfo>,      // Bets in markets that are resolved
    pub total_wagered: TokenAmount,
    pub total_won: TokenAmount,
    pub current_balance: TokenAmount,
}


#[derive(CandidType, Deserialize, Clone, Default)]
pub struct UserBettingSummary {
    pub total_wagered: HashMap<TokenIdentifier, TokenAmount>,
    pub total_won: HashMap<TokenIdentifier, TokenAmount>, 
    pub active_bets: HashMap<TokenIdentifier, TokenAmount>,
}
